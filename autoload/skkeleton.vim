" copied from eskk.vim
function! skkeleton#get_default_mapped_keys() abort "{{{
    return split(
                \   'abcdefghijklmnopqrstuvwxyz'
                \  .'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
                \  .'1234567890'
                \  .'!"#$%&''()'
                \  .',./;:]@[-^\'
                \  .'>?_+*}`{=~'
                \   ,
                \   '\zs'
                \) + [
                \   '<lt>',
                \   '<Bar>',
                \   '<Tab>',
                \   '<BS>',
                \   '<C-h>',
                \   '<CR>',
                \   '<Space>',
                \   '<C-q>',
                \   '<C-y>',
                \   '<C-e>',
                \   '<PageUp>',
                \   '<PageDown>',
                \   '<Up>',
                \   '<Down>',
                \   '<C-n>',
                \   '<C-p>',
                \   '<C-j>',
                \   '<C-g>',
                \   '<Esc>',
                \]
endfunction "}}}

function! skkeleton#map() abort
  for c in skkeleton#get_default_mapped_keys()
    execute printf('lnoremap <buffer> <expr> %s denops#request("skkeleton", "handleKey", ["%s"])', c, substitute(c, '<', '<lt>', 'g'))
  endfor
endfunction

function! skkeleton#unmap() abort
  for c in skkeleton#get_default_mapped_keys()
    execute printf('lunmap <buffer> %s', c)
  endfor
endfunction
