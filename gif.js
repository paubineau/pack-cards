import { GIFEncoder } from './vendor/gifenc/gifenc.mjs';

// Keep all eight bits of each channel: RGB565 buckets merge the subtle shades
// in dark backgrounds before a palette even has a chance to retain them.
function gifPalette(pixels) {
  let opaque=0;
  for (let i=3;i<pixels.length;i+=4) if (pixels[i]>=128) opaque++;
  if (!opaque) return [[0,0,0]];
  const samples=Math.min(opaque,65536), histogram=new Map();
  let seen=0, sampled=0, next=0;
  for (let i=0;i<pixels.length;i+=4) {
    if (pixels[i+3]<128) continue;
    if (seen++!==next) continue;
    const key=(pixels[i]<<16)|(pixels[i+1]<<8)|pixels[i+2];
    histogram.set(key,(histogram.get(key) || 0)+1);
    sampled++;
    // Jitter the sample within each evenly sized group to avoid lining up
    // with repeated foil patterns. This is deterministic across exports.
    const jitter=(Math.imul(sampled,0x9e3779b1)>>>0)/4294967296;
    next=Math.floor((sampled+jitter)*opaque/samples);
  }
  const colors=Array.from(histogram,([key,count])=>[key>>16,(key>>8)&255,key&255,count]);
  if (colors.length<=255) return colors.map(color=>color.slice(0,3));
  function box(items) {
    let count=0;
    const sums=[0,0,0], squares=[0,0,0];
    for (const color of items) {
      count+=color[3];
      for (let channel=0;channel<3;channel++) {
        sums[channel]+=color[channel]*color[3];
        squares[channel]+=color[channel]*color[channel]*color[3];
      }
    }
    const variance=sums.map((sum,channel)=>Math.max(0,squares[channel]-sum*sum/count));
    const channel=variance.indexOf(Math.max(...variance));
    return {items,count,sums,channel,error:variance[0]+variance[1]+variance[2]};
  }
  const boxes=[box(colors)];
  while (boxes.length<255) {
    let selected=-1;
    for (let i=0;i<boxes.length;i++) if (boxes[i].items.length>1 && (selected<0 || boxes[i].error>boxes[selected].error)) selected=i;
    if (selected<0) break;
    const current=boxes[selected], channel=current.channel;
    current.items.sort((a,b)=>a[channel]-b[channel] || a[0]-b[0] || a[1]-b[1] || a[2]-b[2]);
    let count=0, split=0;
    while (split<current.items.length-1 && count<current.count/2) count+=current.items[split++][3];
    boxes[selected]=box(current.items.slice(0,split));
    boxes.push(box(current.items.slice(split)));
  }
  return boxes.map(({sums,count})=>sums.map(sum=>Math.round(sum/count)));
}

function gifIndexed(pixels,width,palette) {
  const indexed=new Uint8Array(pixels.length/4);
  // A direct-mapped cache has a fixed memory cost and compares the full RGB
  // key, unlike a coarse RGB565 cache which introduces its own banding.
  const keys=new Uint32Array(65536), values=new Uint8Array(65536);
  const exact=new Map(palette.map((color,index)=>[(color[0]<<16)|(color[1]<<8)|color[2],index]));
  function nearest(r,g,b) {
    const key=(r<<16)|(g<<8)|b, slot=(Math.imul(key,0x9e3779b1)>>>0)>>>16;
    if (keys[slot]===key+1) return values[slot];
    let selected=0, distance=Infinity;
    for (let i=0;i<palette.length;i++) {
      const color=palette[i], dr=r-color[0], dg=g-color[1], db=b-color[2];
      const error=dr*dr+dg*dg+db*db;
      if (error<distance) { distance=error; selected=i; }
    }
    keys[slot]=key+1; values[slot]=selected;
    return selected;
  }
  let current=new Float32Array((width+2)*3), next=new Float32Array((width+2)*3);
  const height=indexed.length/width;
  for (let y=0;y<height;y++) {
    const direction=y%2 ? -1 : 1;
    for (let x=direction===1 ? 0 : width-1;x>=0 && x<width;x+=direction) {
      const offset=y*width+x, pixel=offset*4, errorOffset=(x+1)*3;
      if (pixels[pixel+3]<128) continue;
      const original=(pixels[pixel]<<16)|(pixels[pixel+1]<<8)|pixels[pixel+2];
      // Leave exact palette colors alone, including solid text and black.
      const exactIndex=exact.get(original);
      if (exactIndex!==undefined) { indexed[offset]=exactIndex+1; continue; }
      const rgb=[0,1,2].map(channel=>Math.max(0,Math.min(255,Math.round(pixels[pixel+channel]+current[errorOffset+channel]))));
      const selected=nearest(...rgb);
      indexed[offset]=selected+1;
      for (let channel=0;channel<3;channel++) {
        // Serpentine Floyd–Steinberg diffusion hides gradient steps. Cap the
        // carried error so high-contrast edges do not produce noisy halos.
        const error=Math.max(-12,Math.min(12,rgb[channel]-palette[selected][channel]));
        current[errorOffset+direction*3+channel]+=error*7/16;
        next[errorOffset-direction*3+channel]+=error*3/16;
        next[errorOffset+channel]+=error*5/16;
        next[errorOffset+direction*3+channel]+=error/16;
      }
    }
    [current,next]=[next,current]; next.fill(0);
  }
  return indexed;
}

/** Encode supplied RGBA frames without a DOM, canvas or worker dependency. */
export function createGifEncoder({repeat=0}={}) {
  if (!Number.isInteger(repeat) || repeat < -1 || repeat > 65535) {
    throw new RangeError('GIF repeat must be an integer from -1 to 65535.');
  }
  const gif=GIFEncoder();
  let width, height, bytes;
  return {
    writeFrame(frame) {
      if (bytes) throw new Error('Cannot write a frame after finishing the GIF.');
      if (!frame || typeof frame !== 'object') throw new TypeError('Expected an RGBA frame.');
      const {width:frameWidth,height:frameHeight,delay=0}=frame;
      for (const value of [frameWidth,frameHeight]) {
        if (!Number.isInteger(value) || value < 1 || value > 65535) {
          throw new RangeError('GIF frame dimensions must be integers from 1 to 65535.');
        }
      }
      if (width !== undefined && (frameWidth !== width || frameHeight !== height)) {
        throw new RangeError('All GIF frames must have the same dimensions.');
      }
      if (!Number.isFinite(delay) || delay < 0 || delay > 655350) {
        throw new RangeError('GIF frame delay must be from 0 to 655350 milliseconds.');
      }
      const pixels=frame.pixels instanceof ArrayBuffer ? new Uint8Array(frame.pixels) : frame.pixels;
      if (!(pixels instanceof Uint8Array) && !(pixels instanceof Uint8ClampedArray)) {
        throw new TypeError('GIF pixels must be a Uint8Array, Uint8ClampedArray or ArrayBuffer.');
      }
      if (pixels.length !== frameWidth*frameHeight*4) {
        throw new RangeError('GIF pixels must contain exactly width × height × 4 RGBA bytes.');
      }
      const palette=gifPalette(pixels), indexed=gifIndexed(pixels,frameWidth,palette);
      // GIF has one-bit alpha. Reserve index 0 after RGB mapping so opaque black
      // never shares its transparency, and use it as the disposal background.
      palette.unshift([0,0,0]);
      gif.writeFrame(indexed,frameWidth,frameHeight,
        {palette,delay,repeat,transparent:true,transparentIndex:0,dispose:2});
      width=frameWidth; height=frameHeight;
    },
    finish() {
      if (width === undefined) throw new Error('Write at least one frame before finishing the GIF.');
      if (!bytes) { gif.finish(); bytes=gif.bytes(); }
      // Each caller owns its result, including when the buffer is transferred.
      return bytes.slice();
    }
  };
}
