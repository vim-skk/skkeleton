#!/usr/bin/env bash

find ./test -name '*.vimspec' | sort | while read spec; do
  themis "$spec" || exit $?
done
