import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';
import {createGifEncoder} from '../gif.js';

function frame(width,height,color) {
  const pixels=new Uint8ClampedArray(width*height*4);
  for (let y=0;y<height;y++) for (let x=0;x<width;x++) pixels.set(color(x,y),(y*width+x)*4);
  return {pixels,width,height};
}

// Decode the actual GIF stream independently of gifenc, so assertions cover
// serialized palettes, LZW data, transparency, frame controls and loop metadata.
function decodeGif(bytes) {
  let offset=0;
  const byte=()=>bytes[offset++];
  const word=()=>byte()+(byte()<<8);
  const text=count=>Array.from({length:count},()=>String.fromCharCode(byte())).join('');
  const colors=count=>Array.from({length:count},()=>[byte(),byte(),byte()]);
  const blocks=()=>{
    const result=[];
    for (let size=byte();size;size=byte()) for (let i=0;i<size;i++) result.push(byte());
    return result;
  };
  assert.equal(text(6),'GIF89a');
  const width=word(),height=word(),packed=byte(),background=byte(); byte();
  const globalPalette=packed&128 ? colors(2**((packed&7)+1)) : [];
  const frames=[]; let control={},repeat;
  while (offset<bytes.length) {
    const marker=byte();
    if (marker===0x3b) return {width,height,background,frames,repeat};
    if (marker===0x21) {
      const label=byte();
      if (label===0xf9) {
        assert.equal(byte(),4);
        const flags=byte(),delay=word()*10,index=byte(); assert.equal(byte(),0);
        control={delay,dispose:(flags>>2)&7,transparent:!!(flags&1),index};
      } else if (label===0xff) {
        const name=text(byte()),data=blocks();
        if (name==='NETSCAPE2.0') repeat=data[1]+(data[2]<<8);
      } else blocks();
      continue;
    }
    assert.equal(marker,0x2c,'Expected a frame image descriptor.');
    const left=word(),top=word(),frameWidth=word(),frameHeight=word(),flags=byte();
    assert.equal(flags&64,0,'These frames are not interlaced.');
    const palette=flags&128 ? colors(2**((flags&7)+1)) : globalPalette;
    const minimum=byte(),data=blocks(),clear=1<<minimum,end=clear+1;
    let size=minimum+1,bits=0,dictionary=[],previous;
    const indices=[];
    while (bits+size<=data.length*8) {
      let code=0;
      for (let i=0;i<size;i++,bits++) code|=((data[bits>>3]>>(bits&7))&1)<<i;
      if (code===clear) {
        dictionary=Array.from({length:clear},(_,i)=>[i]);
        dictionary.length=end+1; size=minimum+1; previous=undefined;
        continue;
      }
      if (code===end) break;
      const entry=dictionary[code] || (code===dictionary.length && previous ? [...previous,previous[0]] : null);
      assert.ok(entry,'Valid LZW dictionary reference.');
      indices.push(...entry);
      if (previous && dictionary.length<4096) {
        dictionary.push([...previous,entry[0]]);
        if (dictionary.length===1<<size && size<12) size++;
      }
      previous=entry;
    }
    assert.equal(indices.length,frameWidth*frameHeight);
    const pixels=new Uint8ClampedArray(indices.length*4);
    for (let i=0;i<indices.length;i++) pixels.set([...palette[indices[i]],control.transparent && indices[i]===control.index ? 0 : 255],i*4);
    frames.push({width:frameWidth,height:frameHeight,left,top,palette,indices,pixels,...control});
    control={};
  }
  assert.fail('Missing GIF trailer.');
}

function encode(frames,options) {
  const gif=createGifEncoder(options);
  for (const supplied of frames) gif.writeFrame(supplied);
  return gif.finish();
}

test('RGBA frames retain delays, one-bit alpha, opaque black and clean disposal',()=>{
  const frames=[];
  for (const [rgb,delay] of [[[255,0,0],3000],[[0,0,255],5000]]) {
    const supplied={...frame(16,16,()=>[...rgb,255]),delay};
    supplied.pixels.set([0,0,0,0],0);
    supplied.pixels.set([0,0,0,255],4);
    supplied.pixels.set([...rgb,127],8);
    supplied.pixels.set([...rgb,128],12);
    if (delay===5000) supplied.pixels.set([0,0,0,0],16);
    frames.push(supplied);
  }
  const decoded=decodeGif(encode(frames));
  assert.equal(decoded.width,16); assert.equal(decoded.height,16); assert.equal(decoded.repeat,0);
  assert.equal(decoded.frames.length,2);
  for (let i=0;i<frames.length;i++) {
    const actual=decoded.frames[i],expected=frames[i];
    assert.equal(actual.delay,expected.delay);
    assert.equal(actual.dispose,2); assert.equal(actual.transparent,true);
    assert.equal(actual.index,decoded.background);
    for (let pixel=0;pixel<actual.indices.length;pixel++) {
      const offset=pixel*4,opaque=expected.pixels[offset+3]>=128;
      assert.equal(actual.pixels[offset+3],opaque ? 255 : 0);
      if (opaque) assert.deepEqual(actual.pixels.slice(offset,offset+3),expected.pixels.slice(offset,offset+3));
    }
  }
});

test('dark gradients keep all shades and encoding never mutates RGBA input',()=>{
  const dark=frame(256,64,x=>{const value=Math.floor(x/4);return [value,value,value,255];});
  const before=dark.pixels.slice(),decoded=decodeGif(encode([dark])).frames[0];
  assert.equal(new Set(decoded.indices).size,64);
  assert.deepEqual(decoded.pixels,before);
  assert.deepEqual(dark.pixels,before);
  const transparent=decodeGif(encode([frame(4,4,()=>[240,0,210,0])])).frames[0];
  assert.ok(transparent.pixels.every(value=>value===0));
});

test('sampled foil gradients preserve fine shades, solid lettering and deterministic output',()=>{
  const colorful=frame(512,384,(x,y)=>{
    if (x<20 || y<20 || x>=492 || y>=364) return [220,30,240,0];
    if (y>384*0.35 && y<384*0.38) return [245,238,222,255];
    const shade=8+36*y/384,light=Math.max(0,1-Math.abs(x/512-y/384)*4),foil=Math.max(0,Math.sin(x/512*9+y/384*7));
    return [shade+light*38+foil*29,shade*0.8+light*16,shade*1.2+foil*54,255];
  });
  const bytes=encode([colorful]),decoded=decodeGif(bytes).frames[0];
  assert.deepEqual(encode([colorful]),bytes);
  assert.ok(decoded.palette.length<=256 && new Set(decoded.indices).size>200);
  let error=0,channels=0;
  for (let i=0;i<colorful.pixels.length;i+=4) {
    if (!colorful.pixels[i+3]) { assert.equal(decoded.pixels[i+3],0); continue; }
    for (let channel=0;channel<3;channel++) { error+=Math.abs(decoded.pixels[i+channel]-colorful.pixels[i+channel]); channels++; }
    if (colorful.pixels[i]===245) assert.deepEqual(decoded.pixels.slice(i,i+4),colorful.pixels.slice(i,i+4));
  }
  assert.ok(error/channels<2,`Mean channel error ${error/channels} stays below two of 256 shades.`);
  // Compare the mean color of small decoded patches with nearest-color mapping
  // using the same serialized palette. Diffusion should reduce visible bands.
  let ditherError=0,plainError=0;
  const nearestColors=new Map();
  for (let top=24;top<352;top+=16) for (let left=24;left<480;left+=16) {
    const expected=[0,0,0],actual=[0,0,0],plain=[0,0,0];
    for (let y=top;y<top+8;y++) for (let x=left;x<left+8;x++) {
      const offset=(y*512+x)*4,rgb=colorful.pixels.slice(offset,offset+3),key=rgb.join(',');
      let nearest=nearestColors.get(key);
      if (!nearest) {
        let distance=Infinity;
        for (const candidate of decoded.palette) {
          const difference=candidate.reduce((sum,value,i)=>sum+(value-rgb[i])**2,0);
          if (difference<distance) { distance=difference; nearest=candidate; }
        }
        nearestColors.set(key,nearest);
      }
      for (let i=0;i<3;i++) { expected[i]+=rgb[i]; actual[i]+=decoded.pixels[offset+i]; plain[i]+=nearest[i]; }
    }
    for (let i=0;i<3;i++) { ditherError+=Math.abs(expected[i]-actual[i]); plainError+=Math.abs(expected[i]-plain[i]); }
  }
  assert.ok(ditherError<plainError*0.6,`Dithered patch error ${ditherError} stays below nearest-color error ${plainError}.`);
});

test('loop configuration, delay precision and buffer views follow the public API',()=>{
  const backing=new Uint8Array([9,9,9,9,13,17,23,255,8,8,8,8]);
  const supplied={pixels:backing.subarray(4,8),width:1,height:1,delay:124};
  const decoded=decodeGif(encode([supplied],{repeat:3}));
  assert.equal(decoded.repeat,3); assert.equal(decoded.frames[0].delay,120);
  assert.deepEqual(Array.from(decoded.frames[0].pixels),[13,17,23,255]);
  assert.equal(decodeGif(encode([{...supplied,pixels:supplied.pixels.slice().buffer}],{repeat:-1})).repeat,undefined);
  assert.deepEqual(Array.from(backing),[9,9,9,9,13,17,23,255,8,8,8,8]);
});

test('invalid frames do not poison the encoder and finish owns its returned bytes',()=>{
  for (const repeat of [-2,65536,1.5,Infinity]) assert.throws(()=>createGifEncoder({repeat}),RangeError);
  const gif=createGifEncoder(),valid=frame(1,1,()=>[0,0,0,255]);
  assert.throws(()=>gif.finish(),/at least one frame/);
  assert.throws(()=>gif.writeFrame(null),TypeError);
  for (const width of [0,-1,65536,NaN,0.5]) assert.throws(()=>gif.writeFrame({...valid,width}),RangeError);
  for (const delay of [-1,Infinity,655351,'5']) assert.throws(()=>gif.writeFrame({...valid,delay}),RangeError);
  assert.throws(()=>gif.writeFrame({...valid,pixels:[0,0,0,255]}),TypeError);
  assert.throws(()=>gif.writeFrame({...valid,pixels:new Uint8Array(3)}),RangeError);
  gif.writeFrame(valid);
  assert.throws(()=>gif.writeFrame(frame(2,1,()=>[0,0,0,255])),/same dimensions/);
  gif.writeFrame(valid);
  const first=gif.finish(),second=gif.finish();
  assert.deepEqual(first,second); assert.notEqual(first.buffer,second.buffer);
  first.fill(0);
  assert.deepEqual(gif.finish(),second);
  assert.equal(decodeGif(second).frames.length,2);
  assert.throws(()=>gif.writeFrame(valid),/after finishing/);
});

test('dedicated worker acknowledges frames, transfers bytes and reports invalid messages',async()=>{
  const replies=[],scope={createGifEncoder,self:{postMessage:(message,transfers)=>replies.push({message,transfers})}};
  const source=await readFile(new URL('../gif-worker.js',import.meta.url),'utf8');
  vm.runInNewContext(source.replace(/^import[^\n]+\n/,''),scope);
  assert.equal(replies.shift().message.ready,true);
  scope.self.onmessage({data:{finish:true}}); assert.equal(replies.shift().message.error,true);
  scope.self.onmessage({data:null}); assert.equal(replies.shift().message.error,true);
  const supplied=frame(2,2,()=>[13,17,23,255]);
  scope.self.onmessage({data:{...supplied,pixels:supplied.pixels.buffer,delay:3000}});
  assert.equal(replies.shift().message.ready,true);
  scope.self.onmessage({data:{finish:true}});
  const {message,transfers}=replies.shift();
  assert.equal(transfers[0],message.bytes.buffer);
  assert.equal(decodeGif(message.bytes).frames[0].delay,3000);
  scope.self.onmessage({data:supplied}); assert.equal(replies.shift().message.error,true);
});
