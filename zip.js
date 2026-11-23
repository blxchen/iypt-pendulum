// Dependency-free ZIP writer (stored entries, UTF-8 names, CRC-32).
const encoder=new TextEncoder();
const table=new Uint32Array(256);
for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;table[n]=c>>>0}
function crc32(bytes){let c=0xffffffff;for(const byte of bytes)c=table[(c^byte)&255]^(c>>>8);return (c^0xffffffff)>>>0}
function u16(view,at,value){view.setUint16(at,value,true)}
function u32(view,at,value){view.setUint32(at,value,true)}
export function makeZip(files){
  if(files.length>65535)throw Error('Too many ZIP entries');
  const parts=[],directory=[];let offset=0;
  for(const [name,content] of files){
    const path=encoder.encode(name),data=typeof content==='string'?encoder.encode(content):content;
    if(path.length>65535||data.length>0xffffffff||offset+data.length>0xffffffff)throw Error('ZIP file is too large');
    const crc=crc32(data),local=new Uint8Array(30+path.length),v=new DataView(local.buffer);
    u32(v,0,0x04034b50);u16(v,4,20);u16(v,6,0x0800);u16(v,8,0);u32(v,14,crc);u32(v,18,data.length);u32(v,22,data.length);u16(v,26,path.length);local.set(path,30);
    parts.push(local,data);directory.push({path,data,crc,offset});offset+=local.length+data.length;
  }
  const directoryStart=offset;
  for(const entry of directory){
    const record=new Uint8Array(46+entry.path.length),v=new DataView(record.buffer);
    u32(v,0,0x02014b50);u16(v,4,20);u16(v,6,20);u16(v,8,0x0800);u16(v,10,0);u32(v,16,entry.crc);u32(v,20,entry.data.length);u32(v,24,entry.data.length);u16(v,28,entry.path.length);u32(v,42,entry.offset);record.set(entry.path,46);
    parts.push(record);offset+=record.length;
  }
  const end=new Uint8Array(22),v=new DataView(end.buffer);
  u32(v,0,0x06054b50);u16(v,8,directory.length);u16(v,10,directory.length);u32(v,12,offset-directoryStart);u32(v,16,directoryStart);
  parts.push(end);return new Blob(parts,{type:'application/zip'});
}
