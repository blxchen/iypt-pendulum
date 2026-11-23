import {derive,derivatives} from './physics.js';
import {fftMagnitude} from './extra-charts.js';
import {makeZip} from './zip.js';

const PI=Math.PI;
const columns=[
  ['time_s','s','Simulation time'],['x_m','m','Bob x coordinate'],['y_m','m','Bob y coordinate'],['z_m','m','Bob z coordinate; z is negative below supports'],
  ['junction_x_m','m','Junction x coordinate'],['junction_y_m','m','Junction y coordinate'],['junction_z_m','m','Junction z coordinate'],
  ['vx_m_s','m/s','Bob x velocity'],['vy_m_s','m/s','Bob y velocity'],['vz_m_s','m/s','Bob z velocity'],['speed_m_s','m/s','Magnitude of bob velocity'],
  ['ax_m_s2','m/s²','Bob x acceleration'],['ay_m_s2','m/s²','Bob y acceleration'],['az_m_s2','m/s²','Bob z acceleration'],['acceleration_m_s2','m/s²','Magnitude of bob acceleration'],
  ['phi_rad','rad','Lower-string x mode angle'],['theta_rad','rad','Junction y mode angle'],['phi_deg','deg','Lower-string x mode angle'],['theta_deg','deg','Junction y mode angle'],
  ['phi_rate_rad_s','rad/s','Time derivative of phi'],['theta_rate_rad_s','rad/s','Time derivative of theta'],['phi_accel_rad_s2','rad/s²','Time derivative of phi rate'],['theta_accel_rad_s2','rad/s²','Time derivative of theta rate'],
  ['horizontal_radius_m','m','Distance of bob from vertical support axis'],['kinetic_energy_J','J','Bob kinetic energy'],['potential_energy_J','J','Potential energy mgz with support-plane zero'],['total_energy_J','J','Kinetic plus potential energy'],['energy_change_J','J','Total energy minus initial total energy']
];
const paramUnits={gravity:'m/s²',mass:'kg',lowerLength:'m',upperLength:'m',supportSpacing:'m',ampX:'deg',ampY:'deg',phase:'deg',gammaX:'1/s',gammaY:'1/s',playbackSpeed:'×',duration:'s',sampleRate:'Hz',trailLength:'s'};
const fmt=x=>Number.isFinite(x)?(Math.abs(x)<5e-13?'0':x.toPrecision(12)):'';
const xml=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
const csvCell=s=>{const v=String(s);return /[",\r\n]/.test(v)?'"'+v.replaceAll('"','""')+'"':v};
const csv=rows=>rows.map(row=>row.map(csvCell).join(',')).join('\n')+'\n';
function measured(r,p,d,E0){
  const l=p.lowerLength,sp=Math.sin(r.phi),cp=Math.cos(r.phi),st=Math.sin(r.theta),ct=Math.cos(r.theta);
  const R=d.h+l*cp,Rdot=-l*sp*r.phiv;
  const [,phidd,,thetadd]=derivatives([r.phi,r.phiv,r.theta,r.thetav],p,d);
  const Rddot=-l*(cp*r.phiv*r.phiv+sp*phidd);
  const ax=l*(-sp*r.phiv*r.phiv+cp*phidd);
  const ay=Rddot*st+2*Rdot*ct*r.thetav+R*(ct*thetadd-st*r.thetav*r.thetav);
  const az=-Rddot*ct+2*Rdot*st*r.thetav+R*(ct*r.thetav*r.thetav+st*thetadd);
  const speed=Math.hypot(r.vx,r.vy,r.vz),kinetic=.5*p.mass*speed*speed,potential=p.mass*p.gravity*r.z;
  return [r.t,r.x,r.y,r.z,r.jx,r.jy,r.jz,r.vx,r.vy,r.vz,speed,ax,ay,az,Math.hypot(ax,ay,az),r.phi,r.theta,r.phi*180/PI,r.theta*180/PI,r.phiv,r.thetav,phidd,thetadd,Math.hypot(r.x,r.y),kinetic,potential,r.energy,r.energy-E0];
}
function frequency(rows,key){
  let first=null,last=null,count=0;
  for(let i=1;i<rows.length;i++){
    const a=rows[i-1],b=rows[i];
    if(a[key]<0&&b[key]>=0&&b[key]!==a[key]){
      const t=a.t+(b.t-a.t)*(-a[key])/(b[key]-a[key]);
      if(first===null)first=t;last=t;count++;
    }
  }
  return count>=2?(count-1)/(last-first):null;
}
function extent(rows,key){let lo=Infinity,hi=-Infinity,squares=0;for(const r of rows){lo=Math.min(lo,r[key]);hi=Math.max(hi,r[key]);squares+=r[key]**2}return {min:lo,max:hi,range:hi-lo,rms:Math.sqrt(squares/rows.length)}}
function peak(spectrum){let best=null;for(let i=1;i<spectrum.length;i++)if(!best||spectrum[i][1]>best[1])best=spectrum[i];return best?.[0]??null}
function plotRows(rows,max=4000){if(rows.length<=max)return rows;const step=Math.ceil((rows.length-1)/(max-1)),out=[];for(let i=0;i<rows.length;i+=step)out.push(rows[i]);if(out.at(-1)!==rows.at(-1))out.push(rows.at(-1));return out}
function bounds(lines,axis){let lo=Infinity,hi=-Infinity;for(const line of lines)for(const point of line){const v=point[axis];if(Number.isFinite(v)){lo=Math.min(lo,v);hi=Math.max(hi,v)}}if(!Number.isFinite(lo))return [-1,1];const pad=Math.max((hi-lo)*.08,Math.abs(hi)*.01,1e-6);return [lo-pad,hi+pad]}
function graph(title,xLabel,yLabel,series,options={}){
  const w=960,h=600,L=83,R=40,T=69,B=70,colors=['#8069d7','#4ba9a1','#e39960','#c85676'];
  const xr=options.xRange||bounds(series.map(s=>s.points),0),yr=options.yRange||bounds(series.map(s=>s.points),1);
  const x=v=>L+(v-xr[0])/(xr[1]-xr[0])*(w-L-R),y=v=>h-B-(v-yr[0])/(yr[1]-yr[0])*(h-T-B);
  let grid='',labels='';for(let i=0;i<=5;i++){const xx=L+(w-L-R)*i/5,yy=T+(h-T-B)*i/5;grid+=`<path d="M${xx} ${T}V${h-B} M${L} ${yy}H${w-R}"/>`;labels+=`<text x="${xx}" y="${h-B+23}" text-anchor="middle">${Number((xr[0]+(xr[1]-xr[0])*i/5).toPrecision(4))}</text><text x="${L-9}" y="${yy+4}" text-anchor="end">${Number((yr[1]-(yr[1]-yr[0])*i/5).toPrecision(4))}</text>`}
  const paths=series.map((s,i)=>{let open=false,path='';for(const [a,b] of s.points){if(!Number.isFinite(a)||!Number.isFinite(b)){open=false;continue}path+=(open?'L':'M')+x(a).toFixed(2)+','+y(b).toFixed(2)+' ';open=true}return `<path d="${path}" fill="none" stroke="${colors[i%colors.length]}" stroke-width="2"/>`}).join('');
  const legend=series.map((s,i)=>`<circle cx="${L+i*180}" cy="48" r="5" fill="${colors[i%colors.length]}"/><text x="${L+11+i*180}" y="52">${xml(s.name)}</text>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><rect width="100%" height="100%" fill="white"/><text x="${L}" y="28" fill="#303847" font-family="sans-serif" font-size="22">${xml(title)}</text><g fill="#647080" font-family="sans-serif" font-size="13">${legend}</g><g fill="none" stroke="#e9ebf0">${grid}</g><g fill="#7f8998" font-family="monospace" font-size="12">${labels}<text x="${w-R}" y="${h-13}" text-anchor="end">${xml(xLabel)}</text><text x="22" y="${T}" transform="rotate(-90 22 ${T})" text-anchor="end">${xml(yLabel)}</text></g><defs><clipPath id="plot"><rect x="${L}" y="${T}" width="${w-L-R}" height="${h-T-B}"/></clipPath></defs><g clip-path="url(#plot)">${paths}</g></svg>`;
}
export function buildExperimentArchive(rows,p,displayTime=0){
  if(!rows.length)throw Error('No simulation samples to export');
  const params={...p},d=derive(params),E0=rows[0].energy,data=rows.map(r=>measured(r,params,d,E0));
  const xs=extent(rows,'x'),ys=extent(rows,'y'),zs=extent(rows,'z'),fx=frequency(rows,'x'),fy=frequency(rows,'y');
  const spectrumX=fftMagnitude(rows.map(r=>r.x),params.sampleRate),spectrumY=fftMagnitude(rows.map(r=>r.y),params.sampleRate);
  let path=0,maxSpeed=0,maxAcceleration=0,maxEnergyChange=0;
  for(let i=0;i<rows.length;i++){const a=data[i];maxSpeed=Math.max(maxSpeed,a[10]);maxAcceleration=Math.max(maxAcceleration,a[14]);maxEnergyChange=Math.max(maxEnergyChange,Math.abs(a[27]));if(i)path+=Math.hypot(a[1]-data[i-1][1],a[2]-data[i-1][2],a[3]-data[i-1][3])}
  const closure=Math.hypot(rows.at(-1).x-rows[0].x,rows.at(-1).y-rows[0].y,rows.at(-1).z-rows[0].z);
  const results=[
    ['sample_count',rows.length,'samples','Full configured run'],['duration_s',rows.at(-1).t-rows[0].t,'s','Last sample time minus first sample time'],
    ['theory_frequency_x_hz',d.fx,'Hz','Small-angle sqrt(g/l)/(2pi)'],['theory_frequency_y_hz',d.fy,'Hz','Small-angle sqrt(g/(h+l))/(2pi)'],['theory_frequency_ratio',d.ratio,'1','Small-angle fx/fy'],
    ['crossing_frequency_x_hz',fx,'Hz','Upward zero crossings of x(t); blank if fewer than two'],['crossing_frequency_y_hz',fy,'Hz','Upward zero crossings of y(t); blank if fewer than two'],['crossing_frequency_ratio',fx&&fy?fx/fy:null,'1','Crossing frequency x divided by y'],
    ['fft_peak_x_hz',peak(spectrumX),'Hz','Largest non-DC Hann-window FFT bin'],['fft_peak_y_hz',peak(spectrumY),'Hz','Largest non-DC Hann-window FFT bin'],
    ['x_range_m',xs.range,'m','max(x)-min(x)'],['y_range_m',ys.range,'m','max(y)-min(y)'],['z_range_m',zs.range,'m','max(z)-min(z)'],
    ['x_rms_m',xs.rms,'m','Root mean square about support axis'],['y_rms_m',ys.rms,'m','Root mean square about support axis'],
    ['x_max_abs_m',Math.max(Math.abs(xs.min),Math.abs(xs.max)),'m','Maximum absolute x displacement'],['y_max_abs_m',Math.max(Math.abs(ys.min),Math.abs(ys.max)),'m','Maximum absolute y displacement'],
    ['max_speed_m_s',maxSpeed,'m/s','Maximum bob speed'],['max_acceleration_m_s2',maxAcceleration,'m/s²','Maximum bob acceleration'],['path_length_m',path,'m','Sum of 3D distances between samples'],['closure_distance_m',closure,'m','3D distance between first and last sample'],
    ['initial_total_energy_J',E0,'J','Potential zero at support plane'],['final_total_energy_J',rows.at(-1).energy,'J','Potential zero at support plane'],['final_energy_change_J',rows.at(-1).energy-E0,'J','Final minus initial total energy'],['max_abs_energy_change_J',maxEnergyChange,'J','Maximum absolute total-energy change'],
    ['junction_radius_h_m',d.h,'m','sqrt(S²-(d/2)²)'],['effective_y_length_m',d.ly,'m','h+l']
  ];
  const subset=plotRows(data),timeSeries=(name,index)=>({name,points:subset.map(r=>[r[0],r[index]])}),phaseSeries=(name,x,y)=>({name,points:subset.map(r=>[r[x],r[y]])});
  const spectrumSeries=[{name:'x',points:spectrumX},{name:'y',points:spectrumY}];
  const graphs=[
    ['01_xy_trajectory.svg',graph('Simulated Lissajous trajectory','x (m)','y (m)',[phaseSeries('bob path',1,2)])],
    ['02_displacement_vs_time.svg',graph('Bob displacement','time (s)','displacement (m)',[timeSeries('x',1),timeSeries('y',2),timeSeries('z',3)],{xRange:[0,params.duration]})],
    ['03_velocity_vs_time.svg',graph('Bob velocity','time (s)','velocity (m/s)',[timeSeries('vx',7),timeSeries('vy',8),timeSeries('vz',9)],{xRange:[0,params.duration]})],
    ['04_speed_vs_time.svg',graph('Bob speed','time (s)','speed (m/s)',[timeSeries('speed',10)],{xRange:[0,params.duration]})],
    ['05_acceleration_vs_time.svg',graph('Bob acceleration','time (s)','acceleration (m/s²)',[timeSeries('ax',11),timeSeries('ay',12),timeSeries('az',13)],{xRange:[0,params.duration]})],
    ['06_energy_vs_time.svg',graph('Bob mechanical energy','time (s)','energy (J)',[timeSeries('kinetic',24),timeSeries('potential',25),timeSeries('total',26)],{xRange:[0,params.duration]})],
    ['07_energy_change_vs_time.svg',graph('Mechanical energy change','time (s)','E - E0 (J)',[timeSeries('energy change',27)],{xRange:[0,params.duration]})],
    ['08_angles_vs_time.svg',graph('Mode angles','time (s)','angle (deg)',[timeSeries('phi',17),timeSeries('theta',18)],{xRange:[0,params.duration]})],
    ['09_x_phase_portrait.svg',graph('X phase portrait','x (m)','vx (m/s)',[phaseSeries('x mode',1,7)])],
    ['10_y_phase_portrait.svg',graph('Y phase portrait','y (m)','vy (m/s)',[phaseSeries('y mode',2,8)])],
    ['11_frequency_spectrum.svg',graph('Hann-window frequency spectrum','frequency (Hz)','amplitude (m)',spectrumSeries,{xRange:[0,params.sampleRate/2],yRange:[0,Math.max(.001,...spectrumX.map(r=>r[1]),...spectrumY.map(r=>r[1]))*1.1]})]
  ];
  const spectrumRows=[['frequency_hz','x_amplitude_m','y_amplitude_m'],...spectrumX.map((r,i)=>[fmt(r[0]),fmt(r[1]),fmt(spectrumY[i][1])])];
  const parameterRows=[['parameter','value','unit'],...Object.entries(params).map(([name,value])=>[name,fmt(value),paramUnits[name]||''])];
  const resultRows=[['metric','value','unit','method'],...results.map(([name,value,unit,method])=>[name,value===null?'':fmt(value),unit,method])];
  const manifest={title:'IYPT 2027 Problem 05 — ideal Y-shaped pendulum simulation',exported_at_utc:new Date().toISOString(),scope:'complete configured run',display_time_at_export_s:displayTime,sample_count:rows.length,source:'simulation, not experimental measurements',model:'massless junction; taut, inextensible strings; point bob; fixed supports; optional angular damping',parameters:params,derived_geometry_and_small_angle:{junction_radius_h_m:d.h,effective_y_length_m:d.ly,fx_hz:d.fx,fy_hz:d.fy,frequency_ratio:d.ratio},results:Object.fromEntries(results.map(([name,value])=>[name,value])),reproduce_url:typeof location!=='undefined'?location.href.split('#')[0]+'#'+new URLSearchParams(Object.entries(params).map(([k,v])=>[k,String(v)])):null};
  const readme=`IYPT 2027 Problem 05 — Y-shaped/Bowditch pendulum\n\nThis archive contains SIMULATED model output, not measurements from a real pendulum. It exports the complete configured run, even if playback was paused or partway through when the ZIP was made. The display time at export was ${fmt(displayTime)} s.\n\nFiles:\n- parameters.csv and manifest.json: all model and display settings, geometry, predicted small-angle frequencies, and results.\n- trajectory.csv: every solver output sample, with SI units in column names. The coordinate origin is the support plane. z is negative below it. The potential-energy zero is z=0.\n- variable_dictionary.csv: meaning and unit of each trajectory column.\n- results.csv: IYPT-relevant summary values and methods.\n- frequency_spectrum.csv: x and y Hann-window FFT amplitudes.\n- graphs/*.svg: axis-labelled, downloadable vector graphs. Graph paths are decimated to at most about 4000 points; CSV data are complete.\n\nThe model uses phi (lower string swing in x) and theta (junction swing in y), fixed-step RK4 substeps no larger than 1/240 s, and a massless junction. Both upper strings have fixed length S; the lower string has fixed length l. h=sqrt(S^2-(d/2)^2), R=h+l*cos(phi). Bob position is (l*sin(phi),R*sin(theta),-R*cos(theta)). Velocity and acceleration are analytic derivatives of this model. Energy is 0.5*m*speed^2+m*g*z. Damping is optional. Mass cancels from ideal motion equations, but scales energy.\n\nCrossing frequencies use upward zero crossings and need at least two crossings. FFT uses a Hann window over the most recent power-of-two samples, capped at 4096 samples. FFT peak may differ from crossing frequency because of harmonics, coupling, transient motion or limited resolution. Peak acceleration and path length are calculated from the sampled trajectory. No uncertainty or measurement noise is included. Tension, string stretch, junction mass and slack are outside this model. Compare the predictions with separately tracked experimental footage.\n`;
  const files=[['README.txt',readme],['manifest.json',JSON.stringify(manifest,null,2)+'\n'],['parameters.csv',csv(parameterRows)],['results.csv',csv(resultRows)],['variable_dictionary.csv',csv([['variable','unit','meaning'],...columns])],['trajectory.csv',csv([columns.map(c=>c[0]),...data.map(r=>r.map(fmt))])],['frequency_spectrum.csv',csv(spectrumRows)],...graphs.map(([name,body])=>['graphs/'+name,body])];
  return {blob:makeZip(files),manifest,files:files.map(([name])=>name)};
}
