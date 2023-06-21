augroup skkeleton-internal
  autocmd!
  autocmd User skkeleton* :
augroup END

let g:skkeleton#enabled = v:false
let g:skkeleton#mode = ''

function! skkeleton#request(funcname, args) abort
  if denops#plugin#wait('skkeleton') != 0
    return ''
  endif
  return denops#request('skkeleton', a:funcname, a:args)
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
  if denops#plugin#is_loaded('skkeleton')
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

function! skkeleton#register_keymap(state, key, func_name)
  " normalize notation
  let key = a:key
  if 1 < strlen(key) && key[0] ==# '<'
    let key = eval('"\' .. key .. '"')
  endif
  let key = get(g:skkeleton#notation#key_to_notation, key, key)

  if len(key) != 1
    let key = tolower(key)
  endif
  call skkeleton#request_async('registerKeyMap', [a:state, key, a:func_name])
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

" return [complete_type, complete_info]
function! s:complete_info() abort
  if exists('*pum#visible') && pum#visible()
    return ['pum.vim', pum#complete_info()]
  elseif has('nvim') && luaeval('select(2, pcall(function() return package.loaded["cmp"].visible() end)) == true')
    let selected = luaeval('require("cmp").get_active_entry() ~= nil')
    return ['cmp', {'pum_visible': v:true, 'selected': selected ? 1 : -1}]
  else
    return ['native', complete_info()]
  endif
endfunction

function! skkeleton#vim_status() abort
  let [complete_type, complete_info] = s:complete_info()
  let m = mode()
  if m ==# 'i'
    let prev_input = getline('.')[:col('.')-2]
  else
    let prev_input = getcmdline()[:getcmdpos()-2]
  endif
  return {
  \ 'prevInput': prev_input,
  \ 'completeInfo': complete_info,
  \ 'completeType': complete_type,
  \ 'mode': m,
  \ }
endfunction

function! skkeleton#handle(func, opts) abort
  let ret = skkeleton#request(a:func, [a:opts, skkeleton#vim_status()])
  if ret =~# "^<Cmd>"
    let ret = "\<Cmd>" .. ret[5:] .. "\<CR>"
  endif
  call skkeleton#doautocmd()
  if get(a:opts, 'expr', v:false)
    return ret
  else
    call feedkeys(ret, 'nit')
  endif
endfunction

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
                \   '<BS>',
                \   '<C-h>',
                \   '<CR>',
                \   '<Space>',
                \   '<C-q>',
                \   '<PageUp>',
                \   '<PageDown>',
                \   '<Up>',
                \   '<Down>',
                \   '<C-j>',
                \   '<C-g>',
                \   '<Esc>',
                \]
endfunction "}}}

let g:skkeleton#mapped_keys = extend(get(g:, 'skkeleton#mapped_keys', []), skkeleton#get_default_mapped_keys())

function! skkeleton#map() abort
  if mode() ==# 'n'
    let modes = ['i', 'c']
  else
    let modes = [mode()]
  endif
  for c in g:skkeleton#mapped_keys
    " notation to lower
    if len(c) > 1 && c[0] ==# '<' && c !=? '<bar>'
      let k = g:skkeleton#notation#key_to_notation[eval('"\' .. c .. '"')]
      let k = '<lt>' .. tolower(k[1:])
    else
      let k = c
    endif
    let func = 'handleKey'
    for m in modes
      let match = matchlist(maparg(c, m), '<Plug>(skkeleton-\(\a\+\))')
      if !empty(match)
        let func = match[1]
      endif
    endfor
    execute printf('lnoremap <buffer> <nowait> %s <Cmd>call skkeleton#handle(%s, {"key": %s})<CR>', c, string(func), string(k))
  endfor
endfunction

function! skkeleton#unmap() abort
  for c in skkeleton#get_default_mapped_keys()
    silent! execute printf('lunmap <buffer> %s', c)
  endfor
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
  echo a:msg
  return getchar()
endfunction

function skkeleton#get_config() abort
  return denops#request('skkeleton', 'getConfig', [])
endfunction
