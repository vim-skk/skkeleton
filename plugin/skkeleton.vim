if exists('g:loaded_skkeleton') && g:loaded_skkeleton
  finish
endif
let g:loaded_skkeleton = v:true

function! s:enable() abort
  while !get(g:, 'skkeleton#init', v:false)
    sleep 1m
  endwhile
  return denops#request('skkeleton', 'enable', [])
endfunction

noremap! <expr> <Plug>(skkeleton-enable) <SID>enable()
autocmd User DenopsPluginPost:skkeleton let g:skkeleton#init = v:true

" hook
autocmd User skkeleton-enable-pre :
autocmd User skkeleton-enable-post :
autocmd User skkeleton-disable-pre :
autocmd User skkeleton-disable-post :
