const qiniu = require('qiniu');
const path = require('path');
const slash = require('slash');

class QiniuPlugin {

  constructor(options) {
    if (!options || !options.ACCESS_KEY || !options.SECRET_KEY) {
      throw new Error('ACCESS_KEY and SECRET_KEY must be provided');
    }
    this.options = Object.assign({}, options);
    qiniu.conf.ACCESS_KEY = this.options.ACCESS_KEY;
    qiniu.conf.SECRET_KEY = this.options.SECRET_KEY;
  }

  apply(compiler) {
    compiler.hooks.afterEmit('UpdatedQiniuWebpackPlugin', (compilation, callback) => {
      const assets = compilation.assets;
      const hash = compilation.hash;
      const {
        bucket,
        include,
      } = this.options;
      let { path: inputPath = '[hash]' } = this.options;
      inputPath = inputPath.replace('[hash]', hash);

      const promises = Object.keys(assets).filter(fileName => {
        let valid = assets[fileName].emitted;
        if (include) {
          valid = valid
            && include.some(
              includeFileName => {
                if (includeFileName instanceof RegExp) {
                  return includeFileName.test(fileName);
                }
                return includeFileName === fileName;
              },
            );
        }
        return valid;
      }).map(fileName => {
        const key = slash(join(path, fileName));
        const putPolicy = new qiniu.rs.PutPolicy(`${bucket}:${key}`);
        const token = putPolicy.token();
        const extra = new qiniu.io.PutExtra();

        const promise = new Promise((resolve, reject) => {
          const begin = Date.now();
          qiniu.io.putFile(token, key, assets[fileName].existsAt, extra, (err, ret) => {
            if (!err) {
              resolve({
                ...ret,
                duration: Date.now() - begin,
              });
            } else {
              reject(err);
            }
          });
        });

        return promise;
      });

      Promise
        .all(promises)
        .then(
          res => {
            console.log('resolve: ', res); // eslint-disable-line no-console
            callback();
          },
          res => {
            console.log('reject: ', res);
          }
        )
        .catch((e) => {
          callback(e);
        });
    });
  }
}

export default QiniuPlugin;
