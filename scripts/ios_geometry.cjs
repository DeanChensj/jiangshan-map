'use strict';

// Flatten the web renderer's SVG boundary paths into GeoJSON line strings.
function svgPathLines(path, project = point => point) {
  const lines=[];
  let line=[],pen=null,origin=null;
  const flush=()=>{if(line.length>1)lines.push(line);line=[];};
  const add=point=>{pen=point;line.push(project(point));};
  for(const match of path.matchAll(/([MLQZ])([^MLQZ]*)/g)) {
    const values=(match[2].match(/-?\d*\.?\d+(?:e[+-]?\d+)?/gi)||[]).map(Number);
    switch(match[1]) {
      case 'M': flush();origin=values.slice(0,2);add(origin);break;
      case 'L': add(values.slice(0,2));break;
      case 'Q': {
        if(!pen)break;
        const start=pen;
        for(let step=1;step<=8;step++) {
          const t=step/8,u=1-t;
          add([u*u*start[0]+2*u*t*values[0]+t*t*values[2],u*u*start[1]+2*u*t*values[1]+t*t*values[3]]);
        }
        break;
      }
      case 'Z': if(origin&&pen&&(pen[0]!==origin[0]||pen[1]!==origin[1]))add(origin);break;
    }
  }
  flush();
  return lines;
}

module.exports={svgPathLines};
