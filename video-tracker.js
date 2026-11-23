import {defaults,download} from './physics.js';
import {trace,series,chartSvg} from './charts.js';
const $=id=>document.getElementById(id),clamp=(v,lo,hi)=>Math.min(hi,Math.max(lo,v));
let cvPromise;
export function loadOpenCV(){
  if(cvPromise)return cvPromise;
  cvPromise=new Promise((resolve,reject)=>{
    let finished=false,attached=null;
    // Emscripten's cv has a .then() method that resolves with cv itself.
    // Resolve a plain wrapper so Promise assimilation cannot loop forever.
    const finish=(error,library)=>{if(finished)return;finished=true;clearTimeout(timer);clearInterval(poll);if(error)reject(error);else resolve({library})};
    const check=()=>{
      if(finished)return;
      const library=window.cv;
      if(library?.Mat){finish(null,library);return}
      if(library&&library!==attached){
        attached=library;
        if(typeof library.then==='function')library.then(ready=>{if(ready?.Mat)finish(null,ready);else check()});
        else library.onRuntimeInitialized=check;
      }
    };
    const timer=setTimeout(()=>finish(Error('OpenCV.js did not initialize within 45 seconds')),45000);
    const poll=setInterval(check,250);
    const script=document.createElement('script');script.src=new URL('./vendor/opencv-4.12.0.js',import.meta.url).href;script.async=true;script.onload=check;script.onerror=()=>finish(Error('Could not load the bundled OpenCV.js file'));document.head.append(script);
    check();
  }).catch(error=>{cvPromise=null;throw error});return cvPromise;
}
export class VideoTracker{
  constructor(){this.video=$('sourceVideo');this.canvas=$('videoCanvas');this.raw=document.createElement('canvas');this.rows=[];this.origin=null;this.target=null;this.seed=null;this.cv=null;this.url=null;this.mode='bob';this.rulerStart=null;this.processing=false;this.abort=false;this.missing=0;this.last=null;this.attach()}
  status(message){$('trackerStatus').textContent=message}
  async prepare(){if(this.cv)return true;this.status('Loading OpenCV.js from this site…');try{this.cv=(await loadOpenCV()).library;for(const name of ['Mat','MatVector','cvtColor','inRange','findContours','contourArea','moments'])if(!this.cv[name])throw Error(`OpenCV.js is missing ${name}`);this.status('OpenCV.js ready.');return true}catch(error){this.cv=null;this.status(`${error.message}. Press Run OpenCV tracking to retry.`);return false}}
  attach(){
    $('videoFile').onchange=async e=>{const file=e.target.files?.[0];if(!file)return;if(this.processing){this.status('Stop tracking before changing video.');e.target.value='';return}this.abort=true;if(this.url)URL.revokeObjectURL(this.url);this.url=URL.createObjectURL(file);this.video.src=this.url;this.rows=[];this.target=null;this.seed=null;this.origin=null;this.last=null;this.missing=0;$('trackProgress').value=0;this.status(`Loading ${file.name}…`);try{await new Promise((resolve,reject)=>{this.video.onloadeddata=resolve;this.video.onerror=()=>reject(Error('Video could not be decoded'));this.video.load()});if(!Number.isFinite(this.video.duration)||this.video.duration<=0)throw Error('This video has no readable duration. Export it as MP4 or WebM and retry.');const scale=Math.min(1,720/this.video.videoWidth),w=Math.max(1,Math.round(this.video.videoWidth*scale)),h=Math.max(1,Math.round(this.video.videoHeight*scale));this.raw.width=this.canvas.width=w;this.raw.height=this.canvas.height=h;$('videoSeek').max=String(Math.max(0,this.video.duration-.001));$('videoPlaceholder').hidden=true;this.drawFrame();this.status(`Video ready: ${w} × ${h} tracking pixels, ${this.video.duration.toFixed(1)} s.`);this.renderGraphs()}catch(error){this.status(error.message)}};
    $('selectBob').onclick=()=>{this.mode='bob';this.status('Click the centre of the bob in the video frame to sample its colour.')};
    $('selectOrigin').onclick=()=>{this.mode='origin';this.status('Click the bob’s equilibrium position to set x = y = 0.')};$('calibrateScale').onclick=()=>{this.mode='ruler1';this.status('Click the first end of a known ruler length in the frame.')};
    this.canvas.onclick=e=>{if(!this.video.videoWidth||this.processing)return;const rect=this.canvas.getBoundingClientRect(),x=clamp(Math.round((e.clientX-rect.left)*this.canvas.width/rect.width),0,this.canvas.width-1),y=clamp(Math.round((e.clientY-rect.top)*this.canvas.height/rect.height),0,this.canvas.height-1);if(this.mode==='origin'){this.origin={x,y};this.status(`Origin set at (${x}, ${y}) px.`)}else if(this.mode==='ruler1'){this.rulerStart={x,y};this.mode='ruler2';this.status('Click the second end of the known ruler length.')}else if(this.mode==='ruler2'){const metres=this.setting('rulerLength',.001,100),distance=Math.hypot(x-this.rulerStart.x,y-this.rulerStart.y);if(distance<2){this.status('Ruler points are too close; select the first point again.');this.mode='ruler1'}else{$('pixelsPerMetre').value=(distance/metres).toFixed(2);this.mode='bob';this.status(`Calibrated ${(distance/metres).toFixed(1)} tracking pixels per metre.`)}}else{this.target={x,y};this.seed=this.pixelHSV(x,y);this.status(`Bob colour selected at (${x}, ${y}) px · HSV ${this.seed.join(', ')}. Set the origin, then run tracking.`)}this.drawPreview()};
    $('videoSeek').onchange=async e=>{if(this.processing)return;await this.seek(Number(e.target.value));this.drawFrame()};
    $('startTracking').onclick=()=>this.run();$('stopTracking').onclick=()=>{this.abort=true;this.video.dispatchEvent(new Event('trackingstop'));this.status('Stopping tracking…')};
    $('trackingCsv').onclick=()=>{if(this.rows.length)download('y-pendulum-video-tracking.csv',this.csv(),'text/csv')};
    $('trackingSvg').onclick=()=>{if(this.rows.length)download('y-pendulum-measured-trace.svg',chartSvg('trace',this.rows,this.plotParams()),'image/svg+xml')};
  }
  setting(id,lo,hi){return clamp(Number($(id).value)||lo,lo,hi)}
  drawFrame(){const w=this.raw.width,h=this.raw.height;if(!w||!h)return;this.raw.getContext('2d',{willReadFrequently:true}).drawImage(this.video,0,0,w,h);this.drawPreview();$('videoTime').textContent=this.video.currentTime.toFixed(2)+' s';$('videoSeek').value=this.video.currentTime}
  drawPreview(){const c=this.canvas.getContext('2d'),w=this.canvas.width,h=this.canvas.height;c.clearRect(0,0,w,h);c.drawImage(this.raw,0,0);if(this.rows.length){c.strokeStyle='#bca9f1';c.lineWidth=2;c.beginPath();let begun=false;for(const r of this.rows){if(!Number.isFinite(r.px)){begun=false;continue}if(!begun){c.moveTo(r.px,r.py);begun=true}else c.lineTo(r.px,r.py)}c.stroke()}if(this.origin){c.strokeStyle='#54d1b2';c.lineWidth=2;c.beginPath();c.moveTo(this.origin.x-12,this.origin.y);c.lineTo(this.origin.x+12,this.origin.y);c.moveTo(this.origin.x,this.origin.y-12);c.lineTo(this.origin.x,this.origin.y+12);c.stroke()}if(this.target){c.strokeStyle='#e8b864';c.lineWidth=2;c.beginPath();c.arc(this.target.x,this.target.y,12,0,2*Math.PI);c.stroke()}}
  pixelHSV(x,y){const c=this.raw.getContext('2d',{willReadFrequently:true}),x0=Math.max(0,x-2),y0=Math.max(0,y-2),w=Math.min(this.raw.width-x0,5),h=Math.min(this.raw.height-y0,5),pixels=c.getImageData(x0,y0,w,h).data,bands=[[],[],[]];for(let i=0;i<pixels.length;i+=4){const r=pixels[i]/255,g=pixels[i+1]/255,b=pixels[i+2]/255,hi=Math.max(r,g,b),lo=Math.min(r,g,b),delta=hi-lo;let hue=0;if(delta){if(hi===r)hue=((g-b)/delta+6)%6;else if(hi===g)hue=(b-r)/delta+2;else hue=(r-g)/delta+4}bands[0].push(Math.round(hue*30)%180);bands[1].push(hi?Math.round(delta/hi*255):0);bands[2].push(Math.round(hi*255))}return bands.map(values=>values.sort((a,b)=>a-b)[Math.floor(values.length/2)])}
  async seek(t){const end=Math.max(0,this.video.duration-.001);t=clamp(t,0,end);if(Math.abs(this.video.currentTime-t)<.002&&this.video.readyState>=2)return;await new Promise((resolve,reject)=>{const timer=setTimeout(()=>{cleanup();reject(Error('Timed out seeking video'))},10000),cleanup=()=>{clearTimeout(timer);this.video.removeEventListener('seeked',done);this.video.removeEventListener('error',fail)},done=()=>{cleanup();resolve()},fail=()=>{cleanup();reject(Error('Could not seek video'))};this.video.addEventListener('seeked',done,{once:true});this.video.addEventListener('error',fail,{once:true});this.video.currentTime=t})}
  detect(){const cv=this.cv,w=this.raw.width,h=this.raw.height,src=cv.imread(this.raw),rgb=new cv.Mat(),hsv=new cv.Mat(),mask=new cv.Mat(),contours=new cv.MatVector(),hierarchy=new cv.Mat();const made=[];try{cv.cvtColor(src,rgb,cv.COLOR_RGBA2RGB);cv.cvtColor(rgb,hsv,cv.COLOR_RGB2HSV);const [H,S,V]=this.seed,dh=this.setting('hueTolerance',1,90),ds=this.setting('satTolerance',1,255),dv=this.setting('valTolerance',1,255),s0=clamp(S-ds,0,255),s1=clamp(S+ds,0,255),v0=clamp(V-dv,0,255),v1=clamp(V+dv,0,255);const ranges=H-dh<0?[[0,H+dh],[180+H-dh,179]]:H+dh>179?[[H-dh,179],[0,H+dh-179]]:[[H-dh,H+dh]];let first=true;for(const [lo,hi] of ranges){const low=new cv.Mat(h,w,cv.CV_8UC3,new cv.Scalar(lo,s0,v0)),high=new cv.Mat(h,w,cv.CV_8UC3,new cv.Scalar(hi,s1,v1)),part=new cv.Mat();made.push(low,high,part);cv.inRange(hsv,low,high,part);if(first){part.copyTo(mask);first=false}else cv.bitwise_or(mask,part,mask)}cv.findContours(mask,contours,hierarchy,cv.RETR_EXTERNAL,cv.CHAIN_APPROX_SIMPLE);const minimum=this.setting('minArea',1,100000),jump=this.setting('maxJump',5,1000),reference=this.last||this.target;let best=null,bestScore=Infinity;for(let i=0;i<contours.size();i++){const contour=contours.get(i);try{const area=cv.contourArea(contour);if(area<minimum)continue;const m=cv.moments(contour);if(!m.m00)continue;const x=m.m10/m.m00,y=m.m01/m.m00,dist=Math.hypot(x-reference.x,y-reference.y);if(dist>jump)continue;const score=dist-0.025*Math.sqrt(area);if(score<bestScore){bestScore=score;best={x,y,area}}}finally{contour.delete()}}return best}finally{src.delete();rgb.delete();hsv.delete();mask.delete();contours.delete();hierarchy.delete();made.forEach(m=>m.delete())}}
  plotParams(){return {...defaults,ampX:0,ampY:0,duration:Math.max(1,this.video.duration),sampleRate:this.setting('trackFps',1,60)}}
  renderGraphs(){if(!this.canvas.width)return;const p=this.plotParams();trace($('trackingTrace'),this.rows,p);series($('trackingSeries'),this.rows,p);const valid=this.rows.filter(r=>Number.isFinite(r.x)),cards=[['DETECTIONS',valid.length,'tracked frames'],['MISSING',this.missing,'no invented positions'],['VIDEO',this.video.duration.toFixed(2),'s'],['CALIBRATION',this.setting('pixelsPerMetre',1,10000),'px/m']];$('trackingMetrics').innerHTML=cards.map(([name,value,unit])=>`<article><span>${name}</span><strong>${value}</strong><em>${unit}</em></article>`).join('')}
  csv(){return 'time_s,x_m,y_m,pixel_x,pixel_y,area_px2\n'+this.rows.map(r=>[r.t,Number.isFinite(r.x)?r.x:'',Number.isFinite(r.y)?r.y:'',Number.isFinite(r.px)?r.px:'',Number.isFinite(r.py)?r.py:'',r.area||''].join(',')).join('\n')+'\n'}
  async nextFrame(){
    return new Promise((resolve,reject)=>{
      let frameId;
      const cleanup=()=>{clearTimeout(timer);this.video.removeEventListener('ended',ended);this.video.removeEventListener('error',failed);this.video.removeEventListener('trackingstop',ended);if(frameId!==undefined)this.video.cancelVideoFrameCallback(frameId)};
      const ended=()=>{cleanup();resolve(null)},failed=()=>{cleanup();reject(Error('Video decoding failed'))};
      const timer=setTimeout(()=>{cleanup();reject(Error('Video playback stalled; try exporting the clip as H.264 MP4'))},15000);
      this.video.addEventListener('ended',ended,{once:true});this.video.addEventListener('error',failed,{once:true});this.video.addEventListener('trackingstop',ended,{once:true});
      frameId=this.video.requestVideoFrameCallback((_,metadata)=>{cleanup();resolve(metadata)});
    });
  }
  async run(){
    if(this.processing)return;
    if(!this.video.videoWidth){this.status('Upload a video first.');return}
    if(!await this.prepare())return;
    if(!this.seed){this.status('Select the bob colour from a video frame first.');return}
    if(!this.origin){this.status('Set the equilibrium origin first.');return}
    this.processing=true;this.abort=false;this.rows=[];this.last={...this.target};this.missing=0;$('startTracking').disabled=true;
    const fps=this.setting('trackFps',1,60),pxm=this.setting('pixelsPerMetre',1,10000),count=Math.min(10000,Math.ceil(this.video.duration*fps));
    $('trackProgress').max=this.video.duration;$('trackProgress').value=0;
    try{
      await this.seek(0);
      if(typeof this.video.requestVideoFrameCallback!=='function')throw Error('This browser needs video frame callbacks; update Safari or Chrome');
      this.video.muted=true;
      let nextSample=0,lastTime=-1;
      const playback=this.video.play();
      while(!this.abort&&this.rows.length<count){
        const frame=await this.nextFrame();
        if(!frame)break;
        const t=frame.mediaTime;
        if(!Number.isFinite(t)||t<=lastTime||t+0.001<nextSample)continue;
        lastTime=t;do{nextSample+=1/fps}while(nextSample<=t+0.001);
        this.raw.getContext('2d',{willReadFrequently:true}).drawImage(this.video,0,0,this.raw.width,this.raw.height);
        const hit=this.detect();
        if(hit){this.last={x:hit.x,y:hit.y};this.rows.push({t,x:(hit.x-this.origin.x)/pxm,y:(this.origin.y-hit.y)/pxm,px:hit.x,py:hit.y,area:hit.area})}
        else{this.missing++;this.rows.push({t,x:NaN,y:NaN,px:NaN,py:NaN,area:0})}
        if(this.rows.length%6===0){$('trackProgress').value=t;$('videoTime').textContent=t.toFixed(2)+' s';$('videoSeek').value=t;this.drawPreview();this.renderGraphs();this.status(`Tracked ${this.rows.length} frames at ${t.toFixed(1)} s · ${this.missing} missing.`);await new Promise(requestAnimationFrame)}
      }
      await playback;
      this.status(this.abort?`Stopped at ${this.rows.length} frames; ${this.missing} missing.`:`Tracking complete: ${this.rows.length-this.missing} detections, ${this.missing} missing frames.`);
      this.renderGraphs();
    }catch(error){this.status(`Tracking failed: ${error.message}`)}
    finally{this.video.pause();this.processing=false;$('startTracking').disabled=false;$('trackProgress').value=Math.min(this.video.currentTime,this.video.duration);this.drawPreview()}
  }
}
