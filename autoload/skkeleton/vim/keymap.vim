let s:keymaps = {}

let s:keymaps.input = {'default': 'kanaInput', 'map': {}}
let s:keymaps.henkan = {'default': 'kanaInput', 'map': {}}

function skkeleton#vim#keymap#handle(context, key) abort
  let keymap = s:keymaps[a:context.state.type]
  let func = get(keymap.map, a:key, keymap.default)
  return skkeleton#vim#function#call(func, a:context, a:key)
endfunction

function skkeleton#vim#keymap#register(state, key, func) abort
  let keymap = s:keymaps[a:state]
  if !a:func
    silent! unlet keymap[a:key]
    return
  endif
  " TODO: functionが妥当か調べる
  let keymap[a:key] = a:func
endfunction

