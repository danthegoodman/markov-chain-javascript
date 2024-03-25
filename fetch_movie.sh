#!/bin/zsh
base="https://raw.githubusercontent.com/gastonstat/StarWars/master/Text_files"
rm -f files/script.txt
curl "$base/SW_EpisodeIV.txt" "$base/SW_EpisodeV.txt" "$base/SW_EpisodeVI.txt" >> files/script.txt
