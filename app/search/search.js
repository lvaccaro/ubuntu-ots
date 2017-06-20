'use strict';


angular.module('myApp.search', ['ngRoute'])

.config(['$routeProvider','$httpProvider', function($routeProvider,$httpProvider) {
  $routeProvider.when('/search/:text', {
    templateUrl: 'search/search.html',
    controller: 'SearchCtrl'
  });
}])

    .factory('ArchiveService', function($http) {
        return {
            search: function(name) {
                //https://alice.btc.calendar.opentimestamps.org/timestamp/e8fb8fa92c9c116f58c0d35d789939be69472529
                //var url = "http://alice.btc.calendar.opentimestamps.org/timestamp/57cfa5c46716df9bd9e83595bce439c58108d8fcc1678f30d4c6731c3f1fa6c79ed712c66fb1ac8d4e4eb0e7";

                var url = "https://crossorigin.me/";
                url += "http://archive.ubuntu.com/ubuntu/pool/main/"+name[0]+"/"+name+"/";
                var headers = {
                    'User-Agent': 'Mozilla/5.0',
                    'Content-Type': 'plain/text'
                };
                return $http({method:'Get',url:url,headers:headers});
            }

        }
    })
    .factory('OpenTimestampsService', function($http) {
        return {
            timestamp: function(hash) {
                //var url = "https://internetarchive.calendar.opentimestamps.org/timestamp/";
                var url = "https://crossorigin.me/";
                url += "http://52.170.200.141/timestamp/";
                url += hash;
                return $http.get(url,{responseType: "arraybuffer"});
            }

        }
    })
    .factory('PackagesService', function($http,$q) {
        return {
            search: function(repofile,name) {
                var defer = $q.defer();
                $http.get(repofile)
                    .success(function(data) {
                        //angular.extend(_this, data);
                        //console.log(data);

                        // check packages container
                        var lines = data.split('\n');
                        var found = -1;
                        for (var i = 0; i < lines.length; i++){
                            if(lines[i].indexOf("Package:")>=0 && lines[i].indexOf(name)>0){
                                found = i;
                                break;
                            }
                        }

                        console.log(found);
                        if(found==-1){
                            return {};
                        }

                        var out={};
                        for (var i=found;i < lines.length;i++){
                            if (lines[i].length=="")
                                break;
                            var key = lines[i].substr(0,lines[i].indexOf(":"));
                            var value = lines[i].substr(lines[i].indexOf(":")+2);
                            out[key]=value;
                        }

                        defer.resolve(out);
                    })
                    .error(function() {
                        defer.reject('could not find Packages.txt');
                    });
                return defer.promise;
            }

        }
    })
    .config(function($sceDelegateProvider) {
        $sceDelegateProvider.resourceUrlWhitelist(['**']);
    })
.controller('SearchCtrl', function($scope, $routeParams, $location, $timeout, $sce, PackagesService, OpenTimestampsService, FileSaver, Blob) {
        $scope.results = [];
        $scope.input=$routeParams.text;
        $scope.showLoader=false;
        $scope.trust = $sce.trustAsHtml;

        var packagesList=[
            "zesty.main.binary-amd64.Packages.txt",
            "zesty.main.binary-i386.Packages.txt",
            "zesty.multiverse.binary-amd64.Packages.txt",
            "zesty.multiverse.binary-i386.Packages.txt",
            "zesty.restricted.binary-amd64.Packages.txt",
            "zesty.restricted.binary-i386.Packages.txt",
            "zesty.universe.binary-amd64.Packages.txt",
            "zesty.universe.binary-i386.Packages.txt"];

        $scope.searching = function() {
            if ($scope.input == "") {
                return;
            }
            $scope.showLoader = true;

            packagesList.forEach(function(repofile){
                PackagesService.search("repo/"+repofile,$scope.input).then(function (data) {
                    console.log(data);
                    $scope.showLoader = false;
                    data.success = "";
                    data.error = "";
                    data.humanFileSize = humanFileSize(data.Size);
                    $scope.results.push(data);
                }).catch(function(err){
                    $scope.showLoader=false;
                    console.error('ubuntu repository not reachable');
                });
            });
        };

        $scope.search = function(){
            $location.path( '/search/' + $scope.input);
        };

        $scope.loadMore = function(){};


        // Startup load search
        if ($scope.input != undefined || $scope.input != ""){
            $scope.searching($scope.input, $scope.page);
        }
        $scope.getOts = function(result){
            OpenTimestampsService.timestamp(result.SHA1).then(function(data) {
                console.log(data);
                result.success = "Downloading and verifying...";

                var timestamp=new Uint8Array(data.data);
                var hexHeader = "004f70656e54696d657374616d7073000050726f6f6600bf89e2e884e8929401";
                var hexOp = "02";
                var hexHash = hash;
                var container = hexToBytes(hexHeader+hexOp+hexHash);

                //console.log(bin2String(data.data));
                //console.log(hexToBytes(container));

                var buffer = new Uint8Array(container.length + timestamp.length);
                buffer.set(container);
                buffer.set(timestamp, container.length);

                var ots=bytesToHex(buffer);
                result.ots=ots;
                console.log(ots);
                download(name+".ots",buffer);
                result.download=false;


                const OpenTimestamps = require('javascript-opentimestamps');
                OpenTimestamps.verify(buffer, hexToBytes(hash), true).then(function(result){
                    if (result === undefined) {
                        result.error='Pending or Bad attestation';
                        console.log('Pending or Bad attestation');
                    } else {
                        result.success='Success! Bitcoin attests data existed as of ' + (new Date(result * 1000));
                        console.log('Success! Bitcoin attests data existed as of ' + (new Date(result * 1000)));
                    }
                    $scope.$apply();
                }).catch(function(err) {
                    console.log(err);
                    result.error = 'We are sorry, something failed, try with another browser';
                    $scope.$apply();
                });

            }).catch(function(err){
                console.log(err);
                if(err instanceof ReferenceError) {
                    result.error = 'Sorry, in-browser verification is not supported on your browser. Try with Chromium or <a href="https://github.com/opentimestamps/opentimestamps-client" style="text-decoration: underline;">client-side</a> validation';
                } else {
                    result.error = 'Sorry, timestamp not yet available for this file';
                }
            });
        };


        /*$scope.getOts = function(identifier,hash,name){
            var element;
            OpenTimestampsService.timestamp(hash).then(function(data) {
                //console.log(data);
                var file = getDocumentFile(identifier,hash);
                file.success = "Downloading and verifying...";

                var timestamp=new Uint8Array(data.data);
                var hexHeader = "004f70656e54696d657374616d7073000050726f6f6600bf89e2e884e8929401";
                var hexOp = "02";
                var hexHash = hash;
                var container = hexToBytes(hexHeader+hexOp+hexHash);

                //console.log(bin2String(data.data));
                //console.log(hexToBytes(container));


                var buffer = new Uint8Array(container.length + timestamp.length);
                buffer.set(container);
                buffer.set(timestamp, container.length);

                var ots=bytesToHex(buffer);
                file.ots=ots;



                const OpenTimestamps = require('javascript-opentimestamps');
                OpenTimestamps.verify(buffer, hexToBytes(hash), true).then(function(result){
                    if (result === undefined) {
                        file.error='Pending or Bad attestation';
                        console.log('Pending or Bad attestation');
                    } else {
                        var d = new Date(result * 1000);
                        var date_array = d.toUTCString();
                        var utc = date_array.split(" ").splice(0,4).join(" ") + " (UTC)";

                        file.success='Success! Bitcoin proves data existed as of ' + utc  ;
                        console.log('Success! Bitcoin proves data existed as of ' + utc );
                    }
                    $scope.$apply();
                }).catch(function(err) {
                    console.log(err);
                    file.error = 'We are sorry, something failed, try with another browser';
                    $scope.$apply();

                });

                download(name+".ots",buffer);
                file.download=false;

            }).catch(function(err){
                console.log(err);
                var file = getDocumentFile(identifier,hash);

                if(err instanceof ReferenceError) {

                  file.error = 'Sorry, in-browser verification is not supported on your browser. Try with Chromium or <a href="https://github.com/opentimestamps/opentimestamps-client" style="text-decoration: underline;">client-side</a> validation';
                } else {
                  file.error = 'Sorry, timestamp not yet available for this file';
                }
            });
        };*/

        function humanFileSize(size) {
            var i = Math.floor( Math.log(size) / Math.log(1024) );
            return ( size / Math.pow(1024, i) ).toFixed(2) * 1 + ' ' + ['B', 'kB', 'MB', 'GB', 'TB'][i];
        };

        function getDocumentFile(package_name){
            // get scope result item
            var result;
            $scope.results.forEach(function(item){
                if(item.Package == package_name){
                    result = item;
                }
            });
            if(result === undefined)
                return;

            return result;
        }

        function download(filename,text){
            var data = new Blob([text], { type: 'octet/stream' });
            FileSaver.saveAs(data, filename);
        }

        function string2Bin(str) {
            var result = [];
            for (var i = 0; i < str.length; i++) {
                result.push(str.charCodeAt(i));
            }
            return result;
        }
        function bin2String(array) {
            return String.fromCharCode.apply(String, array);
        }

        function ascii2hex(str) {
            var arr = [];
            for (var i = 0, l = str.length; i < l; i ++) {
                var hex = Number(str.charCodeAt(i)).toString(16);
                if (hex<0x10) {
                    arr.push("0" + hex);
                } else {
                    arr.push(hex);
                }
            }
            return arr.join('');
        }

        function hex2ascii(hexx) {
            var hex = hexx.toString();//force conversion
            var str = '';
            for (var i = 0; i < hex.length; i += 2)
                str += String.fromCharCode(parseInt(hex.substr(i, 2), 16));
            return str;
        }

        function bytesToHex (bytes) {
            const hex = [];
            for (var i = 0; i < bytes.length; i++) {
                hex.push((bytes[i] >>> 4).toString(16));
                hex.push((bytes[i] & 0xF).toString(16));
            }
            return hex.join('');
        };
        function hexToBytes (hex) {
            const bytes = [];
            for (var c = 0; c < hex.length; c += 2) {
                bytes.push(parseInt(hex.substr(c, 2), 16));
            }
            return bytes;
        };

        function progress( value, tagButton ){
            if(value === true) {
                tagButton.innerHTML = '<div class="smallLoader"></div>IN PROGRESS...';
            } else {
                tagButton.innerHTML = 'SHOW FILES';
            }
        }

    });
