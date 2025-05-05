let s:keymaps = {}

let s:keymaps.input = {'default': 'kanaInput'}
let s:keymaps.henkan = {'default': 'kanaInput'}

function skkeleton#vim#keymap#handle(context, key) abort
  let keymap = s:keymaps[a:context.state.type]
  let func = get(keymap, a:key, keymap.default)
  return skkeleton#vim#function#call(func, a:context, a:key)
endfunction

function skkeleton#vim#keymap#register() abort
endfunction

