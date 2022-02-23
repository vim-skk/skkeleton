augroup skkeleton-internal
  autocmd!
  autocmd User skkeleton* :
augroup END

let g:skkeleton#enabled = v:false
let g:skkeleton#mode = ''

function! skkeleton#request(funcname, args) abort
  call denops#plugin#wait('skkeleton')
  let ret = denops#request('skkeleton', a:funcname, a:args)
  if mode() ==# 'n'
    return ''
  else
    return ret
  endif
endfunction

function! s:doautocmd() abort
  doautocmd <nomodeline> User skkeleton-handled
endfunction

function! skkeleton#doautocmd() abort
  call timer_start(1, {id->s:doautocmd()})
  return ''
endfunction

function! s:send_notify() abort
  for [funcname, args] in s:pending_notify
    call denops#notify('skkeleton', funcname, args)
  endfor
endfunction

function! skkeleton#request_async(funcname, args) abort
  if get(g:, 'skkeleton#init', v:false)
    call denops#request('skkeleton', a:funcname, a:args)
  else
    let s:pending_notify = add(get(s:, 'pending_notify', []), [a:funcname, a:args])
    augroup skkeleton-notify
      autocmd!
      autocmd User DenopsPluginPost:skkeleton call s:send_notify()
    augroup END
  endif
endfunction

function! skkeleton#config(config) abort
  call skkeleton#request_async('config', [a:config])
endfunction

function! skkeleton#register_kanatable(table_name, table, ...) abort
  let create = get(a:000, 0, v:false)
  call skkeleton#request_async('registerKanaTable', [a:table_name, a:table, create])
endfunction

function! skkeleton#is_enabled() abort
  return g:skkeleton#enabled
endfunction

function! skkeleton#mode() abort
  if skkeleton#is_enabled()
    return g:skkeleton#mode
  else
    return ''
  endif
endfunction

" Handling Shougo/pum.vim
function! s:complete_info() abort
  if exists('*pum#visible') && pum#visible()
    return pum#complete_info()
  else
    return complete_info()
  endif
endfunction

function! skkeleton#vim_status() abort
  let m = mode()
  return {
  \ 'completeInfo': s:complete_info(),
  \ 'isNativePum': pumvisible(),
  \ 'mode': m,
  \ }
endfunction

function! skkeleton#handle(func, key) abort
  let ret = denops#request('skkeleton', a:func, [a:key, skkeleton#vim_status()])
  if ret =~# "^<Cmd>"
    let ret = "\<Cmd>" .. ret[5:] .. "\<CR>"
  endif
  call skkeleton#doautocmd()
  return ret
endfunction

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
                \   '<S-Tab>',
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
  if mode() ==# 'n'
    let modes = ['i', 'c']
  else
    let modes = [mode()]
  endif
  for c in skkeleton#get_default_mapped_keys()
    let func = 'handleKey'
    for m in modes
      let match = matchlist(maparg(c, m), '<Plug>(skkeleton-\(\a\+\))')
      if !empty(match)
        let func = match[1]
      endif
    endfor
    execute printf('lnoremap <buffer> <expr> <nowait> %s skkeleton#handle(%s, %s)', c, string(func), string(c))
  endfor
endfunction

function! skkeleton#unmap() abort
  for c in skkeleton#get_default_mapped_keys()
    execute printf('lunmap <buffer> %s', c)
  endfor
endfunction

function! skkeleton#get_key_notations() abort
  let keys = {}
  let keys['<nul>'] = "\<nul>"
  let keys['<bs>'] = "\<bs>"
  let keys['<tab>'] = "\<tab>"
  let keys['<s-tab>'] = "\<s-tab>"
  let keys['<nl>'] = "\<nl>"
  let keys['<ff>'] = "\<ff>"
  let keys['<cr>'] = "\<cr>"
  let keys['<return>'] = "\<return>"
  let keys['<enter>'] = "\<enter>"
  let keys['<esc>'] = "\<esc>"
  let keys['<space>'] = "\<space>"
  let keys['<lt>'] = "\<lt>"
  let keys['<bslash>'] = "\<bslash>"
  let keys['<bar>'] = "\<bar>"
  let keys['<del>'] = "\<del>"
  let keys['<csi>'] = "\<csi>"
  let keys['<xcsi>'] = "\<xcsi>"
  let keys['<eol>'] = "\<eol>"
  let keys['<ignore>'] = "\<ignore>"
  let keys['<nop>'] = "\<nop>"
  let keys['<up>'] = "\<up>"
  let keys['<down>'] = "\<down>"
  let keys['<left>'] = "\<left>"
  let keys['<right>'] = "\<right>"
  let keys['<s-up>'] = "\<s-up>"
  let keys['<s-down>'] = "\<s-down>"
  let keys['<s-left>'] = "\<s-left>"
  let keys['<s-right>'] = "\<s-right>"
  let keys['<c-left>'] = "\<c-left>"
  let keys['<c-right>'] = "\<c-right>"
  let keys['<help>'] = "\<help>"
  let keys['<undo>'] = "\<undo>"
  let keys['<insert>'] = "\<insert>"
  let keys['<home>'] = "\<home>"
  let keys['<end>'] = "\<end>"
  let keys['<pageup>'] = "\<pageup>"
  let keys['<pagedown>'] = "\<pagedown>"
  let keys['<kup>'] = "\<kup>"
  let keys['<kdown>'] = "\<kdown>"
  let keys['<kleft>'] = "\<kleft>"
  let keys['<kright>'] = "\<kright>"
  let keys['<khome>'] = "\<khome>"
  let keys['<kend>'] = "\<kend>"
  let keys['<korigin>'] = "\<korigin>"
  let keys['<kpageup>'] = "\<kpageup>"
  let keys['<kpagedown>'] = "\<kpagedown>"
  let keys['<kdel>'] = "\<kdel>"
  let keys['<kplus>'] = "\<kplus>"
  let keys['<kminus>'] = "\<kminus>"
  let keys['<kmultiply>'] = "\<kmultiply>"
  let keys['<kdivide>'] = "\<kdivide>"
  let keys['<kpoint>'] = "\<kpoint>"
  let keys['<kcomma>'] = "\<kcomma>"
  let keys['<kequal>'] = "\<kequal>"
  let keys['<kenter>'] = "\<kenter>"
  for i in range(1, 12)
    execute printf('let keys["<f%s>"] = "\<f%s>"', i, i)
    execute printf('let keys["<s-f%s>"] = "\<s-f%s>"', i, i)
  endfor
  for i in range(0, 9)
    execute printf('let keys["<k%s>"] = "\<k%s>"', i, i)
  endfor
  for i in range(26)
    let c = nr2char(i + 97)
    execute printf('let keys["<s-%s>"] = "\<s-%s>"', c, c)
    execute printf('let keys["<c-%s>"] = "\<c-%s>"', c, c)
    execute printf('let keys["<m-%s>"] = "\<m-%s>"', c, c)
    execute printf('let keys["<a-%s>"] = "\<a-%s>"', c, c)
    execute printf('let keys["<d-%s>"] = "\<d-%s>"', c, c)
  endfor
  return keys
endfunction

let s:windows = []

function! s:popup(candidates) abort
  if has('nvim')
    let buf = nvim_create_buf(v:false, v:true)
    call nvim_buf_set_lines(buf, 0, -1, v:true, a:candidates)
    let opts = {
          \ 'relative': 'cursor',
          \ 'width': max(map(copy(a:candidates), 'strwidth(v:val)')),
          \ 'height': len(a:candidates),
          \ 'col': 0,
          \ 'row': 1,
          \ 'anchor': 'NW',
          \ 'style': 'minimal'
          \ }
    let win = nvim_open_win(buf, 0, opts)
    call add(s:windows, win)
  else
    let id = popup_create(a:candidates, {
          \ 'pos': 'topleft',
          \ 'line': 'cursor+1',
          \ 'col': 'cursor',
          \ })
    call add(s:windows, id)
  endif
  autocmd skkeleton-internal User skkeleton-handled ++once call s:close()
endfunction

function! s:close() abort
  if mode() ==# 'c'
    " redefine autocmd at cmdline mode
    autocmd skkeleton-internal User skkeleton-handled ++once call s:close()
    return
  endif
  if has('nvim')
    for i in s:windows
      call nvim_win_close(i, v:true)
    endfor
  else
    for i in s:windows
      call popup_close(i)
    endfor
  endif
  let s:windows = []
endfunction

function! skkeleton#show_candidates(candidates) abort
  let s:candidates = a:candidates
  autocmd skkeleton-internal User skkeleton-handled ++once call s:popup(s:candidates)
endfunction

function! skkeleton#close_candidates() abort
  autocmd skkeleton-internal User skkeleton-handled ++once call s:close()
endfunction

function! skkeleton#getchar(msg) abort
  autocmd CmdlineEnter * ++once let s:char = getchar()
  autocmd CmdlineEnter * ++once call feedkeys("\<Esc>", 'n')
  call input(a:msg)
  return s:char
endfunction
