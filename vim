#!/usr/bin/env bash

true
while [[ "$?" != "42" ]]; do
  vim -Nu vimrc
done
