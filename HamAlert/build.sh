#!/bin/sh

#export JAVA_HOME=$(/usr/libexec/java_home -v 1.8.0)
cordova build ios --release --device --buildFlag='-UseModernBuildSystem=0'
cordova build android --release -- --keystore=../keys/hamalert-android.keystore --storePassword=hamalert --alias=hamalert --password=hamalert

rm platforms/android/app/build/outputs/bundle/release/app-release.apks
rm platforms/android/app/build/outputs/bundle/release/universal.apk
bundletool build-apks --mode=universal --bundle=platforms/android/app/build/outputs/bundle/release/app-release.aab --output=platforms/android/app/build/outputs/bundle/release/app-release.apks --ks=../keys/hamalert-android.keystore --ks-key-alias=hamalert --ks-pass=pass:hamalert
cd platforms/android/app/build/outputs/bundle/release
unzip app-release.apks universal.apk
touch universal.apk
bundletool install-apks --apks=app-release.apks
