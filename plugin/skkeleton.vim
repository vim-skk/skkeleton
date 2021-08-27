if exists('g:loaded_skkeleton') && g:loaded_skkeleton
  finish
endif
let g:loaded_skkeleton = v:true

noremap! <expr> <Plug>(skkeleton-enable) denops#request('skkeleton', 'enable', [])
autocmd User DenopsPluginPost:skkeleton let g:skkeleton#init = v:true
