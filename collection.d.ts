export interface PilePlacement {rotation:number; x:number; y:number}
export interface CardSize {width:number; height:number}
export interface CardBounds extends CardSize {left:number; top:number}
export interface CardPileOptions {
  count?:number;
  /** Reuse these positions when restoring a collection. */
  placements?:readonly PilePlacement[];
  renderBack:()=>HTMLElement;
  onPrevious?:()=>void;
  previousLabel?:(position:number)=>string;
  emptyLabel?:string;
  createElement?:<K extends keyof HTMLElementTagNameMap>(tag:K,text?:string|null,className?:string)=>HTMLElementTagNameMap[K];
}
export interface CardDealOptions {
  container:HTMLElement;
  direction:1|-1;
  face:HTMLElement|null;
  bounds:CardBounds|null|undefined;
  /** Pile bounds captured before updating it, for backward deals. */
  origin?:CardBounds;
  turn?:HTMLElement|null;
  deck?:HTMLElement|null;
  current?:HTMLElement|null;
  isActive?:()=>boolean;
  onFinish?:()=>void;
}
export interface CardPile {
  element:HTMLDivElement;
  visual:HTMLDivElement;
  placements:readonly PilePlacement[];
  update(position:number,seen?:ReadonlyMap<number,CardSize>):void;
  /** Null when reduced motion, missing layout, or inactive lifetime skips the effect. */
  animate(options:CardDealOptions):(()=>void)|null;
  dispose():void;
}
/** Requires the core stylesheet. The consumer owns content, order and navigation. */
export function createCardPile(options:CardPileOptions):CardPile;
