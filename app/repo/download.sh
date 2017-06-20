#!/bin/bash
source=("1" "2" "3" "4" "5")
MIRROR="http://archive.ubuntu.com/ubuntu"
VERSION="zesty"

REPOSITORIES=( "main" "universe" "multiverse" "restricted" )
PLATFORMS=( "binary-i386" "binary-amd64" )

for repo in "${REPOSITORIES[@]}"
do
    for plat in "${PLATFORMS[@]}"
    do
        url=$MIRROR"/dists/"$VERSION"/"$repo"/"$plat"/Packages.gz";
        wget -O Packages.gz $url;
        gunzip Packages.gz
        mv Packages $VERSION.$repo.$plat.Packages.txt
    done
done

grep -h "SHA256" *.txt | sed -e 's/SHA256: //g' > SHA256.txt

#wget http://archive.ubuntu.com/ubuntu/dists/zesty/main/binary-amd64/Packages.gz
#gunzip Packages.gz
#mv Packages main.binary-amd64.Packages.gz
#wget http://archive.ubuntu.com/ubuntu/dists/zesty/main/binary-i386/Packages.gz
#gunzip Packages.gz
#mv Packages main.binary-i386.Packages.gz