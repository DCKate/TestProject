var Q = require('q');

function gets3file(bkt, filekey, filename) {
    var defer = Q.defer();
    var AWS = require('aws-sdk');
    var fs = require('fs');
    var s3 = new AWS.S3();
    AWS.config.apiVersions = {
        s3: '2006-03-01'
    };
    // This is where you define bucket and a file for S3 to get
    var params = { Bucket: bkt, Key: filekey };
    var fileStream = fs.createWriteStream(__dirname + '/' + filename.replace(/\//g, "_"));
    
    var s3Stream = s3.getObject(params).createReadStream();
    // Listen for errors returned by the service
    s3Stream.on('error', function (err) {
        // NoSuchKey: The specified key does not exist
        console.error(err);
        defer.reject(' s3stream fail ');
    });

    s3Stream.pipe(fileStream).on('error', function (err) {
        // capture any errors that occur when writing data to the file
        console.error('File Stream:', err);
        defer.reject(' fail ');
    }).on('close', function () {
        console.log('Done ');
        defer.resolve('file close');
    });
    return defer.promise;
}

function puts3file(bkt, filekey, filename) {
    var defer = Q.defer();
    var AWS = require('aws-sdk');
    var fs = require('fs');
    var s3 = new AWS.S3();//{region: 'us-west-2'});
    AWS.config.apiVersions = {
        s3: '2006-03-01'
    };

    var fileStream = fs.createReadStream(__dirname + '/' + filename);
    var putParams = {
        Bucket: bkt,
        Key: filekey,
        Body: fileStream
    };
    s3.putObject(putParams, function (putErr, putData) {
        if (putErr) {
            console.error(putErr);
            defer.reject(' s3stream fail ');
        } else {
            console.log(putData);
            defer.resolve(putData);
        }
    });
    return defer.promise;
}

var ReqHandler = function (req) {
    try {
        this.jreq = JSON.parse(String(req));
    } catch (e) {
        this.jreq = '';
    }
};

ReqHandler.prototype.dowloadS3 = function () {
    var defer = Q.defer();
    if ('resources' in this.jreq && 'source' in this.jreq) {
        var resrcs = this.jreq.resources;
        var promises = [];
        resrcs.forEach(function(element) {
            promises.push(gets3file(this.jreq.source,element, element.replace(/\//g, "_")));
        }, this);
    }
 
    Q.allSettled(promises).then(function(results){
        results.forEach(
			function(result) {
                console.log(result.state);
            }
        );
        console.log('file download');
        defer.resolve('file download');
    });
    return defer.promise;
};

ReqHandler.prototype.zipfile = function () {
    var defer = Q.defer();
     if ('filename' in this.jreq) {
        // require modules
        var fs = require('fs');
        var archiver = require('archiver');
        // create a file to stream archive data to.
        var output = fs.createWriteStream(__dirname + '/' + this.jreq.filename.replace(/\//g, "_"));
        var archive = archiver('zip', {
            zlib: { level: 9 } // Sets the compression level.
        });

        // listen for all archive data to be written
        output.on('close', function () {
            console.log(archive.pointer() + ' total bytes');
            console.log('archiver has been finalized and the output file descriptor has closed.');
            defer.resolve('archive success');
        });

        // good practice to catch warnings (ie stat failures and other non-blocking errors)
        archive.on('warning', function (err) {
            if (err.code === 'ENOENT') {
                // log warning
            } else {
                defer.reject(' fail '+err);
            }
        });

        // good practice to catch this error explicitly
        archive.on('error', function (err) {
            defer.reject(' fail '+err);
        });

        // pipe archive data to the file
        archive.pipe(output);

        for (var rr in this.jreq.resources) {
           
            // append a file
            archive.file(this.jreq.resources[rr].replace(/\//g, "_"));
            console.log('add file: ' + __dirname + '/' + this.jreq.resources[rr].replace(/\//g, "_"));
          
        }
        // finalize the archive (ie we are done appending files but streams have to finish yet)
        archive.finalize();
    }
    return defer.promise;

};

ReqHandler.prototype.uploadS3 = function () {
    if ('filename' in this.jreq && 'target' in this.jreq) {
        console.log('uploading ' + String(this.jreq.filename) + ' to ' + String(this.jreq.target));
        return puts3file(this.jreq.target, this.jreq.filename, this.jreq.filename.replace(/\//g, "_"));
    }
}

function PostCode(hostaddr,hostbody) {
    var http = require('http');
    var defer = Q.defer();
  // Build the post string from an object
 // var post_data = querystring.stringify({
 //     'compilation_level' : 'ADVANCED_OPTIMIZATIONS',
 //     'output_format': 'json',
 //     'output_info': 'compiled_code',
 //       'warning_level' : 'QUIET',
 //       'js_code' : codestring
 // });
 var post_data = '{"cmd":"hello"}';
  // An object of options to indicate where to post to
  var post_options = {
      host: hostaddr,
      port: '55555',
      path: hostbody,
      method: 'POST',
      headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(post_data)
      }
  };

  // Set up the request
  var post_req = http.request(post_options, function(res) {
      res.setEncoding('utf8');
      res.on('data', function (chunk) {
          console.log('Response: ' + chunk);
      });
      defer.resolve('post back');
  });

  // post the data
  post_req.write(post_data);
  post_req.end();
    return defer.promise;
}

function start(){
     var rh = new ReqHandler(req);
     rh.dowloadS3().then(
         function(success){
             console.log(success);
             return rh.zipfile();
         }
     ).then(
         function(success){
             console.log(success);
             return puts3file(rh.jreq.target, rh.jreq.filename, rh.jreq.filename.replace(/\//g, "_"));
         }
     ).then(
         function(success){
             console.log(success);
             return PostCode('127.0.0.1','/');
         }
     ).then(
         function(success){
             console.log('All Tasks success')
         }
     ).done();
    console.log('Finish....');
}
start();
// exports.handler = (event, context, callback) => {
//     
// };
