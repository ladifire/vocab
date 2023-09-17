import { useState, useRef, useEffect } from "react";

import Transcript from "./Transcript";
import { TranscribeButton } from "./TranscribeButton";
import { getMimeType } from "../utils/utils";
import { formatAudioTimestamp } from "../utils/AudioUtils";
import { webmFixDuration } from "../utils/BlobFix";
import { useTranscriber } from "../hooks/useTranscriber";
import Constants from "../utils/Constants";
import Recording from './Recording';

export enum AudioSource {
    URL = "URL",
    FILE = "FILE",
    RECORDING = "RECORDING",
}

const Main = () => {
    const transcriber = useTranscriber();

    const [progress, setProgress] = useState<number | undefined>(undefined);
    const [audioData, setAudioData] = useState<
        | {
              buffer: AudioBuffer;
              url: string;
              source: AudioSource;
              mimeType: string;
          }
        | undefined
    >(undefined);
    const [audioDownloadUrl, setAudioDownloadUrl] = useState<
        string | undefined
    >(undefined);

    const audioRef = useRef<HTMLAudioElement | null>(null);
    const [recording, setRecording] = useState(false);
    const [duration, setDuration] = useState(0);
    const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);

    const streamRef = useRef<MediaStream | null>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);

    const startRecording = async () => {
        // Reset recording (if any)
        setRecordedBlob(null);

        let startTime = Date.now();

        try {
            if (!streamRef.current) {
                streamRef.current = await navigator.mediaDevices.getUserMedia({
                    audio: true,
                });
            }

            const mimeType = getMimeType();
            const mediaRecorder = new MediaRecorder(streamRef.current, {
                mimeType,
            });

            mediaRecorderRef.current = mediaRecorder;

            mediaRecorder.addEventListener("dataavailable", async (event) => {
                if (event.data.size > 0) {
                    chunksRef.current.push(event.data);
                }
                if (mediaRecorder.state === "inactive") {
                    const duration = Date.now() - startTime;

                    // Received a stop event
                    let blob = new Blob(chunksRef.current, { type: mimeType });

                    if (mimeType === "audio/webm") {
                        blob = await webmFixDuration(blob, duration, blob.type);
                    }

                    setRecordedBlob(blob);
                    onRecordingComplete(blob);

                    chunksRef.current = [];
                }
            });
            mediaRecorder.start();
            setRecording(true);
        } catch (error) {
            console.error("Error accessing microphone:", error);
        }
    };

    const stopRecording = () => {
        if (
            mediaRecorderRef.current &&
            mediaRecorderRef.current.state === "recording"
        ) {
            mediaRecorderRef.current.stop(); // set state to inactive
            setDuration(0);
            setRecording(false);
        }
    };

    useEffect(() => {
        let stream: MediaStream | null = null;

        if (recording) {
            const timer = setInterval(() => {
                setDuration((prevDuration) => prevDuration + 1);
            }, 1000);

            return () => {
                clearInterval(timer);
            };
        }

        return () => {
            if (stream) {
                stream.getTracks().forEach((track) => track.stop());
            }
        };
    }, [recording]);

    console.log("progress", progress);

    useEffect(() => {
        if (audioData) {
            console.log("Call transcribe...");
            if (audioData) {
                transcriber.start(audioData.buffer);
            }
        }
    }, [audioData]);

    const handleToggleRecording = () => {
        if (recording) {
            stopRecording();
        } else {
            startRecording();
            setTimeout(() => {
                stopRecording();
            }, 5000)
        }
    };

    const resetAudio = () => {
        setAudioData(undefined);
        setAudioDownloadUrl(undefined);
    };

    const setAudioFromRecording = async (data: Blob) => {
        resetAudio();
        setProgress(0);
        const blobUrl = URL.createObjectURL(data);
        const fileReader = new FileReader();
        fileReader.onprogress = (event) => {
            setProgress(event.loaded / event.total || 0);
        };
        fileReader.onloadend = async () => {
            const audioCTX = new AudioContext({
                sampleRate: Constants.SAMPLING_RATE,
            });
            const arrayBuffer = fileReader.result as ArrayBuffer;
            const decoded = await audioCTX.decodeAudioData(arrayBuffer);
            setProgress(undefined);
            setAudioData({
                buffer: decoded,
                url: blobUrl,
                source: AudioSource.RECORDING,
                mimeType: data.type,
            });
        };
        fileReader.readAsArrayBuffer(data);
    };

    const onRecordingComplete = (blob: Blob) => {
        setAudioFromRecording(blob);
    };

    return (
        <div className='w-full'>
            <button
                type='button'
                className={`m-2 inline-flex justify-center rounded-md border border-transparent px-4 py-2 text-sm font-medium text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 transition-all duration-200 ${
                    recording
                        ? "bg-red-500 hover:bg-red-600"
                        : "bg-green-500 hover:bg-green-600"
                }`}
                onClick={handleToggleRecording}
            >
                {recording
                    ? `Stop Recording (${formatAudioTimestamp(duration)})`
                    : "Start Recording"}
            </button>
            {recording && <Recording/>}
            {/*recordedBlob && (
                <audio className='w-full' ref={audioRef} controls>
                    <source
                        src={URL.createObjectURL(recordedBlob)}
                        type={recordedBlob.type}
                    />
                </audio>
            )*/}
            {transcriber.isBusy && (
                <div className="text-white px-5">Transcribing...</div>
            )}
            {/*audioData && (
                <TranscribeButton
                    onClick={() => {
                        transcriber.start(audioData.buffer);
                    }}
                    isModelLoading={false}
                    isTranscribing={transcriber.isBusy}
                    // isModelLoading={props.transcriber.isModelLoading}
                />
                )*/}
            {!recording && <Transcript transcribedData={transcriber.output} />}
        </div>
    );
};

export default Main;
