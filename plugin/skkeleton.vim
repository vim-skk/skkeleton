noremap! <expr> <Plug>(skkeleton-enable) denops#request('skkeleton', 'enable', [])
autocmd User DenopsPluginPost:skkeleton let g:skkeleton#init = v:true
