export const css=`
.dsb-trigger{cursor:pointer;border:0;background:transparent;color:inherit;padding:4px 7px}
.dsb-backdrop{position:fixed;inset:0;z-index:9999;background:#10151b80;display:grid;place-items:center;padding:1rem}
.dsb-dialog{color-scheme:light dark;background:Canvas;color:CanvasText;border:1px solid GrayText;border-radius:14px;box-shadow:0 14px 60px #0004;padding:1.25rem;width:min(760px,96vw);display:flex;flex-direction:column;max-height:85vh;gap:.8rem}
.dsb-dialog header,.dsb-dialog footer,.dsb-tools{display:flex;flex-wrap:wrap;align-items:center;gap:.55rem}.dsb-dialog header,.dsb-dialog footer{justify-content:space-between}
.dsb-dialog h2{margin:0;font-size:1.2rem}.dsb-dialog button,.dsb-dialog select,.dsb-tools input{font:inherit;background:Canvas;color:CanvasText;border:1px solid #8887;border-radius:6px;padding:.3rem .55rem}.dsb-dialog button{cursor:pointer}.dsb-dialog button:disabled{opacity:.5}.dsb-tools input{flex:1}
.dsb-list{overflow:auto;min-height:4rem}.dsb-list article{display:grid;grid-template-columns:auto 1fr auto;align-items:start;gap:.7rem;border-top:1px solid #8885;padding:.75rem 0}.dsb-list article[data-focused=true]{outline:2px solid Highlight;outline-offset:-2px}.dsb-list .dsb-text{display:block;white-space:pre-wrap;overflow-wrap:anywhere;text-align:left;border:0;padding:0}.dsb-list small,.dsb-dialog footer small{opacity:.75}.dsb-dialog [role=alert]{color:light-dark(#a21d25,#ffb5b9)}
`;
