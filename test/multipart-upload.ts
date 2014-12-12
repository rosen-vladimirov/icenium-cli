///<reference path=".d.ts"/>
"use strict";

import yok = require("../lib/common/yok");

import Future = require("fibers/future");
import stubs = require("./stubs");
import temp = require("temp");
temp.track();
import util = require("util");
var assert = require("chai").assert;
var fileSys = require("fs");

var multipartUploadServiceFile = require("../lib/services/multipart-upload");
var fileSystemFile = require("../lib/common/file-system");
var hashServiceFile = require("../lib/services/hash-service");

class ServiceProxy implements Server.IServiceProxy {
	call<T>(name: string, method: string, path: string, accept: string, body: Server.IRequestBodyElement[], resultStream: WritableStream, headers?: any): IFuture<T> {
		return (() => { }).future<any>()();
	}
	setShouldAuthenticate(shouldAuthenticate: boolean): void {
	}
	setSolutionSpaceName(solutionSpaceName: string): void {
	}
}

function createTestInjector(): IInjector {
	var testInjector = new yok.Yok();

	testInjector.register("fs", fileSystemFile.FileSystem);
	testInjector.register("hashService", hashServiceFile.HashService);
	testInjector.register("errors", stubs.ErrorsStub);
	testInjector.register("logger", stubs.LoggerStub);
	testInjector.register("multipartUploadService", multipartUploadServiceFile.MultipartUploadService);
	// Hack the static variables
	multipartUploadServiceFile.MultipartUploadService.CHUNK_SIZE = 10;
	multipartUploadServiceFile.MultipartUploadService.MIN_CHUNK_SIZE = 2;
	return testInjector;
}

function createTempFile(data: string): IFuture<string> {
	var future = new Future<string>();
	var myData = data; // "Some data that has to be uploaded.";
	var pathToTempFile: string;
	temp.open("tempMultipartUploadFile", function(err, info) {
		if(!err) {
			fileSys.write(info.fd, myData);
			pathToTempFile = info.path;
			future.return(pathToTempFile);
		} else {
			future.throw(err);
		}
	});

	return future;
}

function createTestScenarioForContentRangeValidation(data: string): IFuture<string[]> {
	return (() => {
		var testInjector = createTestInjector();
		
		testInjector.register("server", {
			upload: {
				completeUpload(path: string, originalFileHash: string): IFuture<void>{
					return Future.fromResult();
				},
				initUpload(path: string): IFuture<void>{
					return Future.fromResult();
				},
				uploadChunk(path: string, hash: string, content: any): IFuture<void>{
					return Future.fromResult();
				}
			}
		});

		var actualContentRanges: string[] = [];
		testInjector.register("serviceProxy", {
			call<T>(name: string, method: string, path: string, accept: string, body: Server.IRequestBodyElement[], resultStream: WritableStream, headers?: any): IFuture<T> {
				return (() => {
					actualContentRanges.push(headers["Content-Range"]);
				}).future<any>()();
			},
			setShouldAuthenticate(shouldAuthenticate: boolean): void {
			},
			setSolutionSpaceName(solutionSpaceName: string): void {
			},
		});

		var fs: IFileSystem = testInjector.resolve("fs");

		var mpus: IMultipartUploadService = testInjector.resolve("multipartUploadService");
		var tempFilePath = createTempFile(data).wait();
		var size = fs.getFileSize(tempFilePath).wait();

		mpus.uploadFileByChunks(tempFilePath, "bucketKey").wait();

		return actualContentRanges;
	}).future<string[]>()();
}

function createDataWithSpecifiedLength(length: number): string {
	var data = "";
	for(var i = 0; i < length; i++) {
		data += "a";
	}

	return data;
}

describe("multipart upload service", () => {
	describe("uploadChunk", () => {
		// As the current autogenerated code for uploadChunk method is unusable for us,
		// this test verifies that we are calling our own uploadChunk method.
		it("does NOT call autogenerated UploadChunk", () => {
			var testInjector = createTestInjector();
			var completeUploadCalled = false,
				initUploadCalled = false,
				uploadChunkCalled = false;
			testInjector.register("server", {
				upload: {
					completeUpload(path: string, originalFileHash: string): IFuture<void>{
						return (() => completeUploadCalled = true).future<void>()();
					},
					initUpload(path: string): IFuture<void>{
						return (() => initUploadCalled = true).future<void>()();
					},
					uploadChunk(path: string, hash: string, content: any): IFuture<void>{
						return (() => uploadChunkCalled = true).future<void>()();
					}
				}
			});
			testInjector.register("serviceProxy", ServiceProxy);

			var fs: IFileSystem = testInjector.resolve("fs");
			var mpus: IMultipartUploadService = testInjector.resolve("multipartUploadService");
			var tempFilePath = createTempFile("Some data that has to be uploaded.").wait();
			var size = fs.getFileSize(tempFilePath).wait();

			mpus.uploadFileByChunks(tempFilePath, "bucketKey").wait();
			assert.isTrue(initUploadCalled);
			assert.isTrue(completeUploadCalled);
			assert.isFalse(uploadChunkCalled);
		});

		it("sends correct Content-Ranges", () => {
			var expectedContentRanges = ["bytes 0-9/34", "bytes 10-19/34", "bytes 20-29/34", "bytes 30-33/34"];
			var actualContentRanges = createTestScenarioForContentRangeValidation(createDataWithSpecifiedLength(34)).wait();
			assert.deepEqual(expectedContentRanges, actualContentRanges);
		});

		it("sends correct Content-Ranges when fileSize is exact multiple of chunk size", () => {
			var expectedContentRanges = ["bytes 0-9/20", "bytes 10-19/20"];
			var actualContentRanges = createTestScenarioForContentRangeValidation(createDataWithSpecifiedLength(20)).wait();
			assert.deepEqual(expectedContentRanges, actualContentRanges);
		});

		/* fileSize = (x*chunkSize) - 1 */
		it("sends correct Content-Ranges when fileSize is multiple of chunk size minus one", () => {
			var expectedContentRanges = ["bytes 0-9/19", "bytes 10-18/19"];
			var actualContentRanges = createTestScenarioForContentRangeValidation(createDataWithSpecifiedLength(19)).wait();
			assert.deepEqual(expectedContentRanges, actualContentRanges);
		});

		/* fileSize = (x*chunkSize) + 1 */
		it("sends correct Content-Ranges when fileSize is multiple of chunk size plus one", () => {
			var expectedContentRanges = ["bytes 0-9/21", "bytes 10-20/21"];
			var actualContentRanges = createTestScenarioForContentRangeValidation(createDataWithSpecifiedLength(21)).wait();
			assert.deepEqual(expectedContentRanges, actualContentRanges);
		});
	});
});