if exists('g:loaded_skkeleton') && g:loaded_skkeleton
  finish
endif
let g:loaded_skkeleton = v:true

noremap! <Plug>(skkeleton-enable)  <Cmd>call skkeleton#handle('enable', {})<CR>
noremap! <Plug>(skkeleton-disable) <Cmd>call skkeleton#handle('disable', {})<CR>
noremap! <Plug>(skkeleton-toggle)  <Cmd>call skkeleton#handle('toggle', {})<CR>
autocmd User DenopsPluginPost:skkeleton let g:skkeleton#init = v:true

" Cause unexpected behavior when lmap is empty
" (enable action was failed)
" so makes dummy mapping
lnoremap <Plug>(skkeleton-dummy) :
