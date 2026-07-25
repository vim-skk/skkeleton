augroup skkeleton-internal
  autocmd!
  autocmd User skkeleton* :
augroup END

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
    let mode = 'i'
  else
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
    let match = matchlist(maparg(c, mode), '<Plug>(skkeleton-\(\a\+\))')
    if !empty(match)
      let func = match[1]
    endif
    execute printf('%snoremap <buffer> <nowait> %s <Cmd>call skkeleton#handle(%s, {"key": %s})<CR>',
          \ mode,
          \ c, string(func), string(k))
  endfor
endfunction

function! skkeleton#dangerously_clear_buffer_local_mappings() abort
  let maps = maplist()
  \ ->filter('v:val.buffer && (stridx(get(v:val, "rhs"), "skkeleton") != -1 || stridx(get(v:val, "desc"), "skkeleton") != -1)')
  for m in l:maps
    let lhs = m.lhs->substitute('|', '<Bar>', 'g')
    try
      execute printf('%sunmap <buffer> %s', m.mode, lhs)
    catch
      echohl ErrorMsg
      echo printf('[skkeleton#dangerously_clear_buffer_local_mappings] failed: %sunmap <buffer> %s', m.mode, lhs)
      echohl None
    endtry
  endfor
endfunction

function! skkeleton#doautocmd() abort
  call timer_start(1, {->execute('doautocmd <nomodeline> User skkeleton-handled', '')})
endfunction

function! skkeleton#is_enabled() abort
  return g:skkeleton#enabled
endfunction

" `denops#plugin#wait()`はVimで入力を吸うので自前でそれらしき物を実装する
" 吸うなら吸うで戻せばいいのだ
function s:wait() abort
  let chars = ''
  while !denops#plugin#is_loaded('skkeleton')
    " Note: 吸わないと`<C-c>`の受け付けができないらしい
    let chars ..= getcharstr(0)
    " Note: Neovimではsleepを挟まないとRPCが実行されない
    sleep 1m
  endwhile
  call feedkeys(chars, 'it')
endfunction

function! skkeleton#request(funcname, args) abort
  call s:wait()
  return denops#request('skkeleton', a:funcname, a:args)
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
    call s:notify_later(a:funcname, a:args)
  endif
endfunction

function! skkeleton#notify_async(funcname, args) abort
  if denops#plugin#is_loaded('skkeleton')
    call denops#notify('skkeleton', a:funcname, a:args)
  else
    call s:notify_later(a:funcname, a:args)
  endif
endfunction

function! s:notify_later(funcname, args) abort
  let s:pending_notify = add(get(s:, 'pending_notify', []), [a:funcname, a:args])
  augroup skkeleton-notify
    autocmd!
    autocmd User DenopsPluginPost:skkeleton ++once call s:send_notify()
  augroup END
endfunction

function! skkeleton#config(config) abort
  call skkeleton#request_async('config', [a:config])
endfunction

function! skkeleton#register_keymap(state, key, func_name)
  " normalize notation
  let key = skkeleton#notation#normalize(a:key)
  call skkeleton#request_async('registerKeyMap', [a:state, key, a:func_name])
endfunction

function! skkeleton#register_kanatable(table_name, table, create=v:false) abort
  call skkeleton#request_async('registerKanaTable', [a:table_name, a:table, a:create])
endfunction

function! skkeleton#register_kanatable_file(table_name, path, encoding='', create=v:false) abort
  call skkeleton#request_async('registerKanaTableFile', [a:table_name, a:path, a:encoding, a:create])
endfunction

" return [complete_type, complete_info]
function! s:complete_info() abort
  if exists('*pum#visible') && pum#visible()
    return ['pum.vim', pum#complete_info(['pum_visible', 'selected'])]
  elseif has('nvim') && luaeval('select(2, pcall(function() return package.loaded["cmp"].visible() end)) == true')
    let selected = luaeval('require("cmp").get_active_entry() ~= nil')
    return ['cmp', {'pum_visible': v:true, 'selected': selected ? 1 : -1}]
  else
    return ['native', complete_info(['pum_visible', 'selected'])]
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

function! skkeleton#handle(func, opts) abort
  " normalize opts.key and convert key to notation
  let opts = a:opts->deepcopy()
  let key = opts->get('key')
  if type(key) == v:t_string
    let opts.key = [get(g:skkeleton#notation#key_to_notation, key, key)]
  elseif type(key) == v:t_list
    let opts.key = map(key, 'get(g:skkeleton#notation#key_to_notation, v:val, v:val)')
  else
    let opts.key = ['']
  endif
  let ret = skkeleton#request('handle', [a:func, opts, skkeleton#vim_status()])

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

function! skkeleton#get_config() abort
  return denops#request('skkeleton', 'getConfig', [])
endfunction

let s:complete_items = []
" 補完範囲から外したmarkerHenkanをCompleteDoneで取り除くための記録
let s:completing = {}

function! skkeleton#completefunc(findstart, base) abort
  if a:findstart
    " Note: skkeleton#requestのs:wait()はdenopsが起動するまで戻らないため、
    " 起動していない場合は待たずに補完を諦める
    if !denops#plugin#is_loaded('skkeleton')
      return -3
    endif
    let preedit = skkeleton#request('getPreEdit', [])
    let start = col('.') - strlen(preedit) - 1
    " Note: 補完で確定した直後などpre-editとバッファがずれている状態では、
    " 開始位置が無関係なテキストを指してしまい補完がそれを消してしまう
    if preedit ==# '' || start < 0 ||
    \    strpart(getline('.'), start, strlen(preedit)) !=# preedit
      return -3
    endif
    " Note: 候補が空のまま開始位置を返すとVimが'Pattern not found'を出すため、
    " 候補はここで取得して無ければ補完自体を取り消す
    let s:complete_items = skkeleton#request('getCompleteItems', [])
    if empty(s:complete_items)
      return -3
    endif
    let marker = skkeleton#get_config().markerHenkan
    " Note: 'refresh'が'always'のとき補完で挿入された直後にもfindstartが呼ばれる。
    " そこで-3を返す前にs:completingを捨てるとCompleteDoneがマーカーを消せなく
    " なるため、補完を始められた場合だけ更新する
    let s:completing = {}
    " Note: 'complete'のFフラグ経由の補完はVimが決めた単語境界に候補を挿入する
    " ため、単語文字ではないマーカーまで補完範囲に含めると候補の先頭文字が落ちる
    if marker !=# '' && stridx(preedit, marker) == 0
      let s:completing = #{
      \   bufnr: bufnr('%'),
      \   lnum: line('.'),
      \   marker_start: start,
      \   marker: marker,
      \   rest: strpart(preedit, strlen(marker)),
      \ }
      let start += strlen(marker)
    endif
    return start
  endif

  return {
  \ 'words': s:complete_items,
  \ 'refresh': 'always',
  \ }
endfunction

function! skkeleton#complete_done() abort
  let completing = s:completing
  let s:completing = {}

  let metadata = s:completed_item_metadata()
  if empty(metadata)
    " Note: 候補を選ばずに挿入された場合 ('completeopt' の longest など) は
    " マーカーを消す担い手が他に居ないためここで取り除く
    call s:remove_marker_henkan(completing, v:true)
    return
  endif

  call s:remove_marker_henkan(completing, v:false)

  call skkeleton#request_async('completeCallback',
  \ [metadata.midasi, metadata.word, metadata.type])
endfunction

function! s:completed_item_metadata() abort
  if !exists('v:completed_item') || type(v:completed_item) != v:t_dict
    return {}
  endif

  let user_data = get(v:completed_item, 'user_data', '')
  if type(user_data) != v:t_string || user_data !~# '^\s*{'
    return {}
  endif

  try
    let metadata = json_decode(user_data)
  catch
    return {}
  endtry

  if type(metadata) != v:t_dict
    return {}
  endif
  " Note: 他プラグインのuser_dataも流れてくるため、文字列以外のtagと`!=#`で
  " 比較するとE735/E691/E892で落ちる
  let tag = get(metadata, 'tag', 0)
  if type(tag) != v:t_string || tag !=# 'skkeleton'
    return {}
  endif

  let midasi = get(metadata, 'midasi', 0)
  let word = get(metadata, 'word', 0)
  let henkan_type = get(metadata, 'type', 0)
  if type(midasi) != v:t_string || type(word) != v:t_string || type(henkan_type) != v:t_string
    return {}
  endif
  if henkan_type !=# 'okurinasi' && henkan_type !=# 'okuriari'
    return {}
  endif

  return #{midasi: midasi, word: word, type: henkan_type}
endfunction

function! s:remove_marker_henkan(completing, only_if_replaced) abort
  if empty(a:completing) || a:completing.bufnr != bufnr('%')
  \    || a:completing.lnum != line('.')
    return
  endif
  let line = getline('.')
  let marker_start = a:completing.marker_start
  let marker_len = strlen(a:completing.marker)
  if strpart(line, marker_start, marker_len) !=# a:completing.marker
    return
  endif
  " Note: <C-e>などでpre-editがそのまま戻された場合、マーカーはskkeletonの
  " 状態の一部として必要なため残す
  if a:only_if_replaced &&
  \    strpart(line, marker_start + marker_len, strlen(a:completing.rest)) ==# a:completing.rest
    return
  endif
  let cursor_col = col('.')
  silent! undojoin
  call setline('.',
  \ strpart(line, 0, marker_start) .. strpart(line, marker_start + marker_len))
  if cursor_col > marker_start
    call cursor(line('.'), cursor_col - marker_len)
  endif
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
