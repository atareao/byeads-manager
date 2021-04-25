#!/usr/bin/env bash
#-*- coding: utf-8 -*-

# Copyright (c) 2021 Lorenzo Carbonell <a.k.a. atareao>

# Permission is hereby granted, free of charge, to any person obtaining a copy
# of this software and associated documentation files (the "Software"), to deal
# in the Software without restriction, including without limitation the rights
# to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
# copies of the Software, and to permit persons to whom the Software is
# furnished to do so, subject to the following conditions:

# The above copyright notice and this permission notice shall be included in all
# copies or substantial portions of the Software.

# THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
# IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
# FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
# AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
# LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
# OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
# SOFTWARE.

mustberoot(){
    if [ "$EUID" -ne 0 ]
      then echo "Please run as root"
      exit 1
    fi
}

help(){
    echo "Help"
}

start(){

    mustberoot

    if [ ! -f /etc/hosts.orig ]
    then
        cp /etc/hosts /etc/hosts.orig
    fi

    DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
    hosts_file=${DIR}/hosts.tmp
    if [ -f ${hosts_file} ]
    then
        cat /etc/hosts.orig > /etc/hosts
        echo "" >> /etc/hosts
        echo "##########################" >> /etc/hosts
        echo "#### BYEADS BLOCKLIST ####" >> /etc/hosts
        echo "##########################" >> /etc/hosts
        cat  ${hosts_file} >> /etc/hosts
        exit 0
    fi
    exit 1
}

stop(){

    mustberoot

    cp /etc/hosts.orig /etc/hosts
    exit 0
}

status(){
    ans=$(grep "BYEADS BLOCKLIST" /etc/hosts)
    if [ $? -eq 0 ]
    then
        echo "ENABLED"
        exit 0
    fi
    echo "DISABLED"
    exit 1
}

update(){
    DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
    hosts_file=${DIR}/hosts.tmp
    wget --quiet -O ${hosts_file} https://someonewhocares.org/hosts/zero/hosts
    if [ $? -eq 0 ]
    then
        inicio=$(awk '/#<localhost>/{ print NR; exit }' ${hosts_file})
        fin=$(awk '/#<\/localhost>/{ print NR; exit }' ${hosts_file})
        sed -i "${inicio},${fin}d" ${hosts_file} 
        exit 0
    fi
    exit 1
}

case $1 in
    --start)
        start
        ;;
    --stop)
        stop
        ;;
    --status)
        status
        ;;
    --update)
        update
        ;;
esac

help

