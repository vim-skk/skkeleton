function skkeleton#vim#state#mkdefault() abort
  " TODO: get kanatable from config
  return {
  \   'type': 'input',
  \   'mode': 'direct',
  \   'direct_input': v:false,
  \   'table': skkeleton#vim#kana#get('rom'),
  \   'converter': '',
  \   'feed': '',
  \   'henkan_feed': '',
  \   'okuri_feed': '',
  \   'previous_feed': v:false,
  \ }
endfunction

function s:to_string_input(state) abort
  let ret = ''
  if a:state.mode != 'direct'
    " TODO: markerHenkan用意する
    let ret = '▽' .. a:state.henkan_feed
  endif
  if a:state.mode == 'okuriari'
    if !previous_feed
      return ret .. a:state.feed .. '*'
    else
      let ..= '*' .. a:state.okuri_feed
    endif
  endif
  " TODO: converter実装する
  " if (state.converter) {
  "   ret = state.converter(ret);
  " }
  return ret .. a:state.feed
endfunction

function skkeleton#vim#state#to_string(state) abort
  if a:state.type == 'input'
    return s:to_string_input(a:state)
  endif
  return ''
endfunction
