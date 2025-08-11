function s:kakutei_kana(state, preedit, kana, feed) abort
  if a:state.mode == 'direct'
  "     if (state.converter) {
  "       kana = state.converter(kana);
  "     }
    call skkeleton#vim#preedit#kakutei(a:preedit, a:kana)
  elseif a:state.mode == 'okurinasi'
    let state.henkan_feed ..= a:kana
  elseif a:state.mode == 'okuriari'
    if !empty(a:feed) && a:state.previous_feed
      let a:state.henkan_feed ..= a:kana
    else
      let a:state.okuri_feed ..= a:kana
    endif
    let state.previous_feed = v:false
  endif
  let a:state.feed = a:feed
endfunction

function s:accept_result(context, result, feed) abort
" TODO
" export async function acceptResult(
"   context: Context,
"   result: KanaResult,
"   feed: string,
" ) {
"   if (Array.isArray(result)) {
"     await doKakutei(context, result[0], result[1]);
"   } else {
"     const state = context.state as InputState;
"     state.feed = "";
"     await result(context, feed);
"   }
" }
  call s:kakutei_kana(a:context.state, a:context.preedit, a:result[0], '')
endfunction

" /data/code/vim/skkeleton/skkeleton/denops/skkeleton/kana.ts
function skkeleton#vim#function#input#kana(context, char) abort
  let state = a:context.state
  let state.type = 'input'

  " TODO: AIに書かせたやつなので後で書き直す
  " let lower = has_key(g:config.lowercaseMap, a:char) ? g:config.lowercaseMap[a:char] : tolower(a:char)
  " if !get(state, 'directInput', 0) && a:char !=# lower
  "   let withShift = '<s-' . lower . '>'
  "   let found = 0
  "   for entry in state.table
  "     if entry[0] =~? '^' . state.feed . withShift
  "       let found = 1
  "       break
  "     endif
  "   endfor
  "   if found
  "     let char = withShift
  "   else
  "     call HenkanPoint(a:context)
  "     call KanaInput(a:context, lower)
  "     return
  "   endif
  " endif

  let next = state.feed .. a:char
  let found = state.table->copy()->filter('stridx(v:val[0], next) == 0')

  if len(found) == 1 && found[0][0] ==# next
    " 正確にマッチした場合はそのまま確定
    call s:accept_result(a:context, found[0][1], next)
  elseif len(found) > 0
    " テーブルに残余があったらfeedに積む
    let state.feed = next
  elseif state.feed !=# ''
    let idx = indexof(state.table, {->v:val[0] ==# state.feed})
    let current = idx == -1 ? v:null : state.table[idx]
    if !empty(current)
      call s:accept_result(a:context, current[0][1], next)
    elseif get({}, 'acceptIllegalResult', 0)
      " TODO: config生やそうな
      call s:kakutei_kana(state, a:context.preedit, state.feed, '')
    else
      let state.feed = ''
    endif
    call skkeleton#vim#function#input#kana(a:context, a:char)
  else
    " feedが無い場合(=テーブルに存在しない文字)
    " そのまま確定してしまう
    call s:kakutei_kana(state, a:context.preedit, a:char, '')
  endif
endfunction

