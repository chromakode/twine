var _ = require('lodash')
var merge = require('merge-stream')
var gulp = require('gulp')
var gutil = require('gulp-util')
var streamify = require('gulp-streamify')
var less = require('gulp-less')
var uglify = require('gulp-uglify')
var source = require('vinyl-source-stream')
var watchify = require('watchify')
var browserify = require('browserify')

var dest = './build'

var jsModules = {
  './src/index.js': 'loopre.min.js',
  './src/b64worker.js': 'b64worker.min.js',
  './src/wavworker.js': 'wavworker.min.js'
}

gulp.task('js', function(){
  return merge(_.map(jsModules, function(destName, srcName) {
    return browserify(srcName)
      .bundle()
      .pipe(source(destName))
      .pipe(streamify(uglify()))
      .on('error', gutil.log.bind(gutil, 'browserify error'))
      .pipe(gulp.dest(dest))
  }))
})

gulp.task('less', function() {
  return gulp.src('./src/loopre.less')
    .pipe(less({compress: true}))
    .on('error', gutil.log.bind(gutil, 'less error'))
    .pipe(gulp.dest(dest))
})

gulp.task('html', function() {
  return gulp.src('./src/index.html')
    .pipe(gulp.dest(dest))
})

gulp.task('watchify', function() {
  // via https://github.com/gulpjs/gulp/blob/master/docs/recipes/fast-browserify-builds-with-watchify.md
  return merge(_.map(jsModules, function(destName, srcName) {
    var bundler = watchify(browserify(srcName, watchify.args))
    bundler.on('log', gutil.log.bind(gutil, 'watchify'))
    bundler.on('update', rebundle)

    function rebundle() {
      return bundler.bundle()
        .on('error', gutil.log.bind(gutil, 'watchify error'))
        .pipe(source(destName))
        .pipe(gulp.dest(dest))
    }

    return rebundle()
  }))
})

gulp.task('watch', function () {
  gulp.watch('./src/**/*.less', ['less'])
  gulp.watch('./src/**/*.svg', ['less'])
  gulp.watch('./src/**/*.html', ['html'])
})

gulp.task('build', ['js', 'less', 'html'])
gulp.task('default', ['less', 'html', 'watch', 'watchify'])
