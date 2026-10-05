export class Scene {
  constructor(canvas) {
    this.canvas=canvas;this.az=-.62;this.el=.38;this.zoom=1;this.drag=null;
    canvas.addEventListener('pointerdown',e=>{this.drag=[e.clientX,e.clientY];canvas.setPointerCapture(e.pointerId)});
    canvas.addEventListener('pointermove',e=>{if(!this.drag)return;this.az+=(e.clientX-this.drag[0])*.008;this.el=Math.max(-.2,Math.min(1.4,this.el+(e.clientY-this.drag[1])*.008));this.drag=[e.clientX,e.clientY]});
    canvas.addEventListener('pointerup',()=>this.drag=null);
    canvas.addEventListener('wheel',e=>{e.preventDefault();this.zoom=Math.max(.55,Math.min(2.8,this.zoom*(e.deltaY>0?.92:1.08)))},{passive:false});
  }
  reset(){this.az=-.62;this.el=.38;this.zoom=1}
  draw(p,r,history,showTrail){
    const canvas=this.canvas,dpr=window.devicePixelRatio||1,w=canvas.clientWidth,h=canvas.clientHeight;
    canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);
    const c=canvas.getContext('2d');c.scale(dpr,dpr);c.clearRect(0,0,w,h);
    const scale=Math.min(w,h)*.52*this.zoom,az=this.az,el=this.el;
    const project=(x,y,z)=>{const u=x*Math.cos(az)-y*Math.sin(az),v=x*Math.sin(az)+y*Math.cos(az);return [w/2+u*scale,h*.3+(v*Math.sin(el)-z*Math.cos(el))*scale]};
    const line=(a,b,color,width=2,dash=[])=>{c.strokeStyle=color;c.lineWidth=width;c.setLineDash(dash);c.beginPath();c.moveTo(...a);c.lineTo(...b);c.stroke();c.setLineDash([])};
    const dot=(pt,radius,color)=>{c.fillStyle=color;c.beginPath();c.arc(...pt,radius,0,2*Math.PI);c.fill()};
    const a=p.supportSpacing/2,L=project(-a,0,0),R=project(a,0,0),J=project(r.jx,r.jy,r.jz),B=project(r.x,r.y,r.z),floorZ=-Math.sqrt(p.upperLength*p.upperLength-a*a)-p.lowerLength,origin=project(0,0,floorZ);
    for(let i=-4;i<=4;i++){const v=i*.2;line(project(-.8,v,floorZ),project(.8,v,floorZ),'#e3e1ee',1);line(project(v,-.8,floorZ),project(v,.8,floorZ),'#e3e1ee',1)}
    line(origin,project(.66,0,floorZ),'#b3a9cc',1);line(origin,project(0,.66,floorZ),'#b3a9cc',1);
    c.fillStyle='#9389a7';c.font='11px monospace';c.fillText('X',...project(.7,0,floorZ));c.fillText('Y',...project(0,.7,floorZ));
    if(showTrail&&history.length){
      c.strokeStyle='#b7a4eb';c.lineWidth=1.4;c.beginPath();const stride=Math.max(1,Math.floor(history.length/12000));for(let i=0;i<history.length;i+=stride){const q=history[i],pt=project(q.x,q.y,floorZ);i?c.lineTo(...pt):c.moveTo(...pt)}c.stroke();
      const recent=history.filter(q=>q.t>=r.t-p.trailLength);c.strokeStyle='#8069d7a8';c.lineWidth=2;c.beginPath();recent.forEach((q,i)=>{const pt=project(q.x,q.y,q.z);i?c.lineTo(...pt):c.moveTo(...pt)});c.stroke();
    }
    line(L,R,'#897e9e',5);line(L,J,'#6e6684',2.5);line(R,J,'#6e6684',2.5);line(J,B,'#6e6684',2.5);line(B,project(r.x,r.y,floorZ),'#aaa4b8',1,[4,5]);
    dot(L,4,'#6e6684');dot(R,4,'#6e6684');dot(J,5,'#4ba9a1');dot(B,12,'#8069d7');dot(B,5,'#fdfbff');
    c.fillStyle='#a39bad';c.font='11px monospace';c.fillText('DRAG · ROTATE / SCROLL · ZOOM',18,h-18);
  }
}
