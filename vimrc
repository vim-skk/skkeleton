set nocompatible

if has('nvim')
  noremap <C-c> <Cmd>restart<CR>
  noremap! <C-c> <Cmd>restart<CR>
else
  noremap <C-c> <Cmd>cquit 1<CR>
  noremap! <C-c> <Cmd>cquit 1<CR>
endif

nnoremap ' :
nnoremap Q <Cmd>cquit 42<CR>

let g:skkeleton#use_denops = v:false
execute 'set rtp+=' .. expand('<script>:p:h')
inoremap <Right> <Plug>(skkeleton-enable)
