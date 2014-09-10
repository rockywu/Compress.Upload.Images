/**
 * 多图压缩上传功能，兼容ios&android,同是可以用作多文件上传
 * compress.upload.images
 * @package src/
 * @author rockywu wjl19890427@hotmail.com
 * @created 09-09-2014
 * @site www.rockywu.com
 */
;(function() {
    "use strict";
    var CUI,
        Tools = {
            extend : function(a,b) {
                var k;
                for(k in b) {
                    a[k] = b[k];
                }
                return a;
            },
            rotate : function (canvasTarget, image, w, h,orientation){
                if(orientation==6 || orientation==8){
                    canvasTarget.width = h;
                    canvasTarget.height = w;
                }else{
                    canvasTarget.width = w;
                    canvasTarget.height = h;
                }
                var ctxtarget = canvasTarget.getContext("2d");
                if(orientation==6){
                    ctxtarget.translate(h, 0);
                    ctxtarget.rotate(Math.PI / 2);
                }else if(orientation==8){
                    ctxtarget.translate(0,w);
                    ctxtarget.rotate(270*Math.PI/180 );
                }else if(orientation==3){
                    ctxtarget.translate(w,h);
                    ctxtarget.rotate(Math.PI );
                }
                ctxtarget.drawImage(image, 0, 0);
            }
        };
    CUI = function(params) {
        this.callbackFuns = [ 
            'onSelect',     //文件选择后
            'onDelete',     //文件删除后
            'onProgress',   //文件上传进度
            'onSuccess',    //文件上传成功时
            'onFailure',    //文件上传失败时,
            'onComplete'    //文件全部上传完毕时
        ];
        this.defParams = {
            file : null,        //input file dom对象
            uploadUrl : null,   //上传地址
            maxWidth : 0,       //图片压缩最大宽度像素默认为0，不压缩
            maxHeight : 0,      //图片压缩最大高度像素默认为0，不压缩
            inputName : 'file', //设置默认提交的input name 为file
        };
        this.params = Tools.extend(this.defParams, params);   //统一参数
        this.fileFilter = [];   //文件过滤器
        this.fileLists = [];    //文件数组
        this.defBoundary = "--image-someboundary--";
        this.init();            //初始化回调方法
    }
    CUI.prototype = {
        constructor : CUI,
        init : function(p) {
            var k,fun;
            for(k in this.callbackFuns) {
                fun = this.callbackFuns[k];
                if(typeof this.params[fun] === 'function') {
                    this.constructor.prototype[fun] = this.params[fun];
                } else {
                    this.constructor.prototype[fun] = function() {};
                }
            }
        },
        msg : function(msg) {
            console.log(msg);
        },
        upload : function() {
            var files, k;
            if(typeof this.params.file !== 'object' ||  this.params.file === null) {
                this.msg('请输入input file对象');
                return false;
            }
            files = this.params.file.files;
            if(files.length < 1 ) {
                this.msg('请选择上传的文件');
                return false;
            }
            for(k = 0; k < files.length; k++) {
                if(files[k].type  === "image/jpeg") {
                    if(parseInt(this.params.maxWidth) > 0 && parseInt(this.params.maxHeight) > 0) {
                        this.compressUpload(files[k]);
                    } else {
                        this.doUpload(files[k]);
                    }
                } else {
                    this.doUpload(files[k]);
                }
            }
        },
        doUpload :function(file, data, boundary) {
            var self = this,
                formData,
                xhr = new XMLHttpRequest();    //初始化xhr对象
            if(!xhr.upload) {
                this.msg('浏览器无法使用xhr.upload对象');
                return false;
            }
            // 文件上传中
            xhr.upload.addEventListener("progress", function(e) {
                self.onProgress(file, e.loaded, e.total);
            });
            // 文件上传成功或是失败
            xhr.onreadystatechange = function(e) {
                if (xhr.readyState == 4) {
                    if (xhr.status == 200) {
                        self.onSuccess(file, xhr.responseText);
                        //self.funDeleteFile(file);
                        //if (!self.fileFilter.length) {
                        //    //全部完毕
                        //    self.onComplete();
                        //}
                    } else {
                        self.onFailure(file, xhr.responseText);
                    }
                }
            };
            // 开始上传
            xhr.open("POST", this.params.uploadUrl, true);
            if(typeof data === 'undefined' || data === '') {
                formData = new FormData();
                formData.append('file', file);
                xhr.send(formData);
            } else {
                console.log(boundary);
                boundary = boundary || this.params.defBoundary;
                console.log(boundary);
                if (XMLHttpRequest.prototype.sendAsBinary === undefined) {
                    XMLHttpRequest.prototype.sendAsBinary = function(string) {
                        var bytes = Array.prototype.map.call(string, function(c) {
                            return c.charCodeAt(0) & 0xff;
                        });
                        this.send(new Uint8Array(bytes).buffer);
                    };
                }
                var myEncoder = new JPEGEncoder(),
                    JPEGImage = myEncoder.encode(data,100);
                    data = JPEGImage.substr(23);    //删除base64头
                xhr.setRequestHeader('Content-Type', 'multipart/form-data; boundary=' + boundary);
                xhr.sendAsBinary(['--' + boundary, 'Content-Disposition: form-data; name="' + this.params.inputName + '"; filename="' + file.name + '"', 'Content-Type: ' + file.type, '', atob(data), '--' + boundary + '--'].join('\r\n'));
            }
        },
        compressUpload : function(file) {
            var self = this,
                reader = new FileReader(),
                img = document.createElement('img');
            reader.readAsDataURL(file);
            reader.onload = function(e) {
                img.src = this.result;
            }
            img.onload = function() {
                var width = 0,
                    height = 0,
                    base64 = '',
                    mpImg = new MegaPixImage(file),
                    orientation = 1, //照片方向值
                    tmpImg = document.createElement('img');
                if(img.width < self.maxWidth && img.height < self.maxHeight) {
                    width = img.width;
                    height = img.height;
                } else {
                    //逻辑还未完成
                    width = img.width;
                    height = img.height;
                }
                mpImg.render(tmpImg, {maxWidth: width, maxHeight: height });
                EXIF.getData(file, function() {
                    orientation=EXIF.getTag(this,'Orientation');
                    tmpImg.onload=function(){
                        var tmpCvs = document.createElement("canvas"),
                            tmpCtx = tmpCvs.getContext('2d'),
                            data = '';
                        Tools.rotate(tmpCvs, tmpImg, width, height, orientation);
                        if(orientation == 6 || orientation == 8){
                            data = tmpCtx.getImageData(0, 0, height, width);
                        } else {
                            data = tmpCtx.getImageData(0, 0, width, height);
                        }
                        self.doUpload(file, data, "kfstouch-someboundary");
                    }
                });
            }
        }
    };

    window.CUI = CUI;
})();
