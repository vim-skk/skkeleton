augroup skkeleton-internal
  autocmd!
  execute 'autocmd User skkeleton* :'
augroup END

let g:skkeleton#use_denops = get(g:, 'skkeleton#use_denops', v:true)

" 参照用の写し
let g:skkeleton#enabled = v:false
let g:skkeleton#mode = ''
let g:skkeleton#state = #{
\   phase: '',
\ }

function! skkeleton#mode() abort
  if skkeleton#is_enabled()
    return g:skkeleton#mode
  else
    return ''
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
  \   '<C-j>',
  \   '<C-g>',
  \   '<Esc>',
  \]
endfunction "}}}

let g:skkeleton#mapped_keys = extend(get(g:, 'skkeleton#mapped_keys', []), skkeleton#get_default_mapped_keys())

function! skkeleton#map() abort
  if mode() ==# 'n'
    let modes = ['i', 'c']
    let mode = 'i'
  else
    let modes = [mode()]
    let mode = mode()
  endif

  call skkeleton#internal#map#save(mode)

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
    execute printf('%snoremap <buffer> <nowait> %s <Cmd>call skkeleton#handle(%s, {"key": %s})<CR>',
    \ mode,
    \ c, string(func), string(k))
  endfor
endfunction

function! skkeleton#doautocmd() abort
  call timer_start(1, {->execute('doautocmd <nomodeline> User skkeleton-handled', '')})
endfunction

function! skkeleton#is_enabled() abort
  return g:skkeleton#enabled
endfunction

function! skkeleton#handle(func, opts) abort
  " normalize opts.key and convert key to notation
  let opts = a:opts->deepcopy()
  let key = opts->get('key')
  if type(key) == v:t_string
    let key = [key]
  endif
  if type(key) == v:t_list
    let opts.key = map(key, 'get(g:skkeleton#notation#key_to_notation, v:val, v:val)')
  endif
  if g:skkeleton#use_denops
    let ret = skkeleton#denops#request('handle', [a:func, opts, skkeleton#vim_status()])
  else
    let ret = skkeleton#vim#handle(a:func, opts)
  endif

  let g:skkeleton#state = ret.state

  let result = ret.result
  if result =~# "^<Cmd>"
    let result = "\<Cmd>" .. result[5:] .. "\<CR>"
  endif

  call skkeleton#doautocmd()

  if get(a:opts, 'expr', v:false)
    return result
  endif

  if result !=# ''
    call feedkeys(result, 'nit')
  endif
endfunction

if g:skkeleton#use_denops
  function! skkeleton#config(config) abort
    call skkeleton#denops#request_async('config', [a:config])
  endfunction

  function! skkeleton#register_keymap(state, key, func_name)
    " normalize notation
    let key = skkeleton#notation#normalize(a:key)
    call skkeleton#denops#request_async('registerKeyMap', [a:state, key, a:func_name])
  endfunction

  function! skkeleton#register_kanatable(table_name, table, ...) abort
    let create = get(a:000, 0, v:false)
    call skkeleton#denops#request_async('registerKanaTable', [a:table_name, a:table, create])
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
    elseif m ==# 't'
      let current_line = has('nvim') ? getline('.') : term_getline('', '.')
      let col = has('nvim') ? col('.') : term_getcursor(bufnr('%'))[1]
      let prev_input = current_line[:col-2]
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

  function! skkeleton#get_config() abort
    return denops#request('skkeleton', 'getConfig', [])
  endfunction

  function! skkeleton#initialize() abort
    call skkeleton#notify_async('initialize', [])
  endfunction

  function! skkeleton#disable()
    if g:skkeleton#enabled
      doautocmd <nomodeline> User skkeleton-disable-pre
      call skkeleton#internal#map#restore()
      call skkeleton#internal#option#restore()
      let g:skkeleton#mode = ''
      doautocmd <nomodeline> User skkeleton-mode-changed
      doautocmd <nomodeline> User skkeleton-disable-post
      let g:skkeleton#enabled = v:false
    endif
  endfunction

  function! skkeleton#update_database(path, ...) abort
    let encoding = a:0 > 0 ? a:1 : ''
    let force = a:0 > 1 ? a:2 : v:false
    call skkeleton#notify_async('updateDatabase', [a:path, encoding, force])
  endfunction
else
  function! skkeleton#get_config() abort
    throw 'todo'
  endfunction

  function skkeleton#register_kanatable(name, table, ...) abort
    let create = get(a:000, 0, v:false)
    call skkeleton#vim#kana#register(a:name, a:table, create)
  endfunction

  function skkeleton#register_keymap(state, key, func_name) abort
    " normalize notation
    let key = skkeleton#notation#normalize(a:key)
    call skkeleton#vim#keymap#register(a:state, key, a:func_name)
  endfunction
endif
