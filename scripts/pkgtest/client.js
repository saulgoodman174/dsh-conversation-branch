window.__ModuleLoader__.load({id:'rewind-pkgtest-fixture',factory:()=>({
  name:'rewind-pkgtest-fixture',inject:['uiWorkspace','sessions'],apply(ctx){
    window.pkgtestSessionListed=id=>Boolean(ctx.sessions.list.getSnapshot().byId[id]);
    window.openPkgtestSession=id=>ctx.get('uiWorkspace').openSession(id);
  }
})});
