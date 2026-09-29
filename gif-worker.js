import {createGifEncoder} from './gif.js';

// Dedicated module worker. Send an RGBA frame or {finish:true}; each accepted
// frame receives {ready:true}, and finish transfers {bytes:Uint8Array}.
const gif=createGifEncoder();
self.onmessage=({data}) => {
  try {
    if (data.finish) {
      const bytes=gif.finish();
      self.postMessage({bytes},[bytes.buffer]);
    } else {
      gif.writeFrame(data);
      self.postMessage({ready:true});
    }
  } catch (_) {
    self.postMessage({error:true});
  }
};
self.postMessage({ready:true});
