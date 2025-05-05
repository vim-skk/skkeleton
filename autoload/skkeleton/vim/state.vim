function skkeleton#vim#state#mkdefault() abort
  " TODO: get kanatable from config
  return {
  \   'type': 'input',
  \   'mode': 'direct',
  \   'direct_input': v:false,
  \   'table': skkeleton#vim#kana#get('rom'),
  \   'converter': '',
  \   'feed': '',
  \   'henkanFeed': '',
  \   'okuriFeed': '',
  \   'previousFeed': v:false,
  \ }
endfunction
