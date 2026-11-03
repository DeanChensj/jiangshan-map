#!/usr/bin/env python3
"""Summarize Instruments On Display intervals for the atlas camera sweep.

Input tables are exported by xctrace: metal-perf-overview-layer-per-frame-
interval-metric and PointsOfInterestEvents. Never substitutes render callbacks
or vsync counts for actual drawable presentations.
"""
import argparse
import csv
import hashlib
import json
import math
import re
import shutil
import xml.etree.ElementTree as ET
from pathlib import Path


def table(path):
    root = ET.parse(path).getroot()
    refs = {e.attrib['id']: e for e in root.iter() if 'id' in e.attrib}
    for row in root.findall('.//row'):
        yield [refs.get(e.attrib.get('ref'), e) for e in row]


def percentile(values, percent):
    values = sorted(values)
    at = (len(values) - 1) * percent / 100
    lo, hi = math.floor(at), math.ceil(at)
    return values[lo] + (values[hi] - values[lo]) * (at - lo)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--intervals', type=Path, required=True)
    parser.add_argument('--events', type=Path, required=True)
    parser.add_argument('--sdk', type=Path, required=True)
    parser.add_argument('--toc', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    sdk = json.loads(args.sdk.read_text())
    if sdk.get('explicitRequestedFPS') == 120 and not sdk.get('verified120FPSRequest'):
        raise ValueError('The requested 120 FPS setting was not verified at both ends of capture')
    info = ET.parse(args.toc).getroot().find('.//run/info')
    device = info.find('target/device')
    target_pid = info.find('target/process').attrib['pid']
    frames = []
    for row in table(args.intervals):
        if (row[6].attrib.get('fmt') != 'On Display' or row[8].text != 'JiangshanAtlas'
                or row[7].find('pid').text != target_pid):
            continue
        number = int(re.search(r'Frame (\d+)', row[11].attrib['fmt']).group(1))
        frames.append((int(row[0].text), int(row[1].text), number, row[9].text))
    if not frames or len({f[3] for f in frames}) != 1:
        raise ValueError('Expected exactly one atlas Metal layer with On Display data')
    phases = {}
    for row in table(args.events):
        if row[3].text == 'me.jiangshan.atlas' and row[4].text == 'Atlas Camera Phase':
            phase = int(re.search(r'phase=(\d+)', row[5].attrib['fmt']).group(1))
            phases[phase] = int(row[0].text)
    seconds = sdk['phaseDurationSeconds']
    step = seconds * 1_000_000_000
    # Deferred Instruments capture omitted phase 0 in this run. Later phase
    # events still anchor the same fixed schedule; cross-check their agreement.
    if len(phases) < 2:
        raise ValueError('At least two camera-phase signposts are required to cross-check alignment')
    first = min(phases)
    start = phases[first] - first * step
    disagreement = max(abs(t - (start + p * step)) for p, t in phases.items())
    if disagreement > 20_000_000:
        raise ValueError('Phase anchors disagree by more than 20 ms')
    frames = sorted(f for f in frames if start <= f[0] < start + 3 * step and f[1] > 0)
    if len({f[2] for f in frames}) != len(frames):
        raise ValueError('Duplicate frame numbers')

    def summarize(name, begin, end):
        rows = [f for f in frames if begin <= f[0] < end]
        if len(rows) < 2:
            raise ValueError('Not enough presentations for ' + name)
        durations = [f[1] / 1e6 for f in rows]
        return dict(phase=name, seconds=(end - begin) / 1e9,
                    presentedFrames=len(rows), presentedFPS=len(rows) / ((end - begin) / 1e9),
                    activePresentationCadenceFPS=(len(rows)-1) / ((rows[-1][0]-rows[0][0])/1e9),
                    onDisplayP50Ms=percentile(durations, 50),
                    onDisplayP95Ms=percentile(durations, 95),
                    onDisplayP99Ms=percentile(durations, 99),
                    onDisplayMaxMs=max(durations))

    summary = dict(sourceRevision=sdk['sourceRevision'], runID=sdk['runID'],
                   startedAtUTC=sdk['startedAt'], deviceModel=device.attrib['model'], os=sdk['os'],
                   configuration='signed Release', requestedFPS=sdk['mapPreferredFPS'],
                   verified120FPSRequest=sdk.get('verified120FPSRequest', False),
                   mapPreferredFPSAtStart=sdk.get('mapPreferredFPSAtStart'),
                   screenMaximumFPS=sdk['screenMaximumFPS'], lowPowerMode=sdk['lowPowerMode'],
                   thermalState=sdk['thermalState'], scene=sdk['scene'],
                   tool='Instruments '+info.find('summary/instruments-version').text+', Game Performance Overview + Display + Points of Interest',
                   metric='Map CAMetalLayer drawable On Display interval starts; actual presentations',
                   anchorTraceNanoseconds=start, phaseAnchorDisagreementMs=disagreement/1e6,
                   recordedPhaseIndices=sorted(phases),
                   firstNewPresentationSeconds=(frames[0][0]-start)/1e9,
                   phases=[summarize(name, start+i*step, start+(i+1)*step)
                           for i, name in enumerate(sdk['phases'])],
                   overall=summarize('overall', start, start+3*step),
                   limits=['One instrumented automated sweep, not a touch-latency or battery test.',
                           f"Recorded map preference {sdk['mapPreferredFPS']} FPS is not a measured presentation rate.",
                           'Initial same-camera target produces a hold before the first new pan frame.',
                           'No claim of uninstrumented FPS or cause of the observed cadence.',
                           'Only the successful map-layer presentation export is included.'],
                   inputSHA256={p.name: hashlib.sha256(p.read_bytes()).hexdigest()
                                for p in [args.intervals, args.events, args.sdk, args.toc]})
    args.output.mkdir(parents=True, exist_ok=True)
    with (args.output / 'presentations.csv').open('w') as f:
        writer = csv.writer(f)
        writer.writerow(['elapsed_nanoseconds', 'frame_number', 'on_display_nanoseconds'])
        writer.writerows((t-start, n, d) for t, d, n, _ in frames)
    with (args.output / 'phase-signposts.csv').open('w') as f:
        writer = csv.writer(f)
        writer.writerow(['phase_index', 'trace_nanoseconds'])
        writer.writerows(sorted(phases.items()))
    (args.output / 'summary.json').write_text(json.dumps(summary, indent=2)+'\n')
    shutil.copyfile(args.sdk, args.output / 'camera-sdk.json')
    print(json.dumps(dict(phases=summary['phases'], overall=summary['overall']), indent=2))


if __name__ == '__main__':
    main()
