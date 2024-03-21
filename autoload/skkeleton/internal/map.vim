let s:vault = {}

function skkeleton#internal#map#save(mode) abort
  let bufnr = bufnr()
  let s:vault[bufnr] = get(s:vault, bufnr, {})
  let buf = s:vault[bufnr]
  if has_key(buf, a:mode)
    return
  endif
  if exists('*nvim_buf_get_keymap')
    let buf[a:mode] = nvim_buf_get_keymap(bufnr, a:mode)
  elseif exists('*maplist')
    let buf[a:mode] = maplist()->filter('v:val.buffer && v:val.mode == a:mode')
  endif
endfunction

function skkeleton#internal#map#restore() abort
  let bufnr = bufnr()
  let buf = get(s:vault, bufnr, {})
  for [mode, maps] in items(buf)
    execute mode .. 'mapclear <buffer>'
    for m in maps
      call mapset(mode, v:false, m)
    endfor
  endfor
  silent! unlet s:vault[bufnr]
endfunction
