"use client";
import React from "react";
import * as ReactGoogleMaps from "@/libraries/react-google-maps";
import { useUpload } from "../utilities/runtime-helpers";

const NEXT_PUBLIC_GOOGLE_MAPS_API_KEY =
  process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

function MainComponent() {
  const [upload, { loading: uploadLoading }] = useUpload();
  const [image, setImage] = useState(null);
  const [dogInfo, setDogInfo] = useState(null);
  const [error, setError] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [aspectRatio, setAspectRatio] = useState("1:1");
  const [saturation, setSaturation] = useState(100);
  const [brightness, setBrightness] = useState(100);
  const [modelRotation, setModelRotation] = useState(0);
  const [darkMode, setDarkMode] = useState(true);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [analysisSteps, setAnalysisSteps] = useState([
    { name: "Analyzing Image", complete: false },
    { name: "Identifying Breed", complete: false },
    { name: "Generating Report", complete: false },
  ]);
  const handleImageUpload = useCallback(
    async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      try {
        setError(null);
        const img = new Image();
        img.src = URL.createObjectURL(file);

        img.onload = async () => {
          const canvas = document.createElement("canvas");
          const ctx = canvas.getContext("2d");

          let width = img.width;
          let height = img.height;

          const [ratioWidth, ratioHeight] = aspectRatio.split(":").map(Number);
          const targetRatio = ratioWidth / ratioHeight;
          const currentRatio = width / height;

          if (currentRatio > targetRatio) {
            width = height * targetRatio;
          } else {
            height = width / targetRatio;
          }

          canvas.width = width;
          canvas.height = height;

          ctx.filter = `saturate(${saturation}%) brightness(${brightness}%)`;
          ctx.drawImage(img, 0, 0, width, height);

          canvas.toBlob(async (blob) => {
            const { url, error } = await upload({
              file: new File([blob], file.name, { type: file.type }),
            });
            if (error) throw error;
            setImage(url);
            setDogInfo(null);
          }, file.type);
        };
      } catch (err) {
        setError("Failed to upload image. Please try again.");
      }
    },
    [upload, aspectRatio, saturation, brightness]
  );

  React.useEffect(() => {
    const interval = setInterval(() => {
      setModelRotation((prev) => (prev + 1) % 360);
    }, 50);
    return () => clearInterval(interval);
  }, []);

  const [generatedImage, setGeneratedImage] = useState(null);

  const generateDogImage = useCallback(async () => {
    if (!dogInfo) return;

    try {
      const response = await fetch(
        "/integrations/dall-e-3/?prompt=" +
          encodeURIComponent(
            `Create a stylized artistic portrait of a dog with these characteristics: ${dogInfo.physical}. Style: Digital art, vibrant colors, professional pet portrait`
          ),
        {
          method: "GET",
        }
      );

      const data = await response.json();
      if (data.data?.[0]) {
        setGeneratedImage(data.data[0]);
      } else {
        throw new Error("Failed to generate image");
      }
    } catch (err) {
      setError("Failed to generate artistic image. Please try again.");
    }
  }, [dogInfo]);

  const analyzeImage = useCallback(async () => {
    if (!image) return;

    setAnalyzing(true);
    setError(null);
    setAnalysisProgress(0);
    setAnalysisSteps((steps) =>
      steps.map((step) => ({ ...step, complete: false }))
    );

    try {
      const messages = [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Analyze this dog image and provide detailed information about the breed's physical characteristics.",
            },
            {
              type: "image_url",
              image_url: {
                url: image,
              },
            },
          ],
        },
      ];

      const response = await fetch("/integrations/gpt-vision/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages }),
      });

      const data = await response.json();
      if (!data.choices?.[0]?.message?.content) {
        throw new Error("Failed to analyze image");
      }

      setAnalysisProgress(25);
      setAnalysisSteps((steps) =>
        steps.map((step, i) => (i === 0 ? { ...step, complete: true } : step))
      );

      const analysis = data.choices[0].message.content;
      const sections = analysis.split("\n\n");

      const formattedInfo = {
        physical: sections[0] || "No physical characteristics available",
      };

      if (sections[0]) {
        await fetch("/api/db/animal-info", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query:
              "INSERT INTO `dog_breeds` (`breed_name`, `description`, `temperament`, `exercise_needs`, `grooming_requirements`) VALUES (?, ?, ?, ?, ?)",
            values: [
              "Unknown Breed",
              sections[0],
              "Analysis in progress",
              "Varies by breed",
              "Regular grooming recommended",
            ],
          }),
        });
      }

      setAnalysisProgress(100);
      setAnalysisSteps((steps) =>
        steps.map((step) => ({ ...step, complete: true }))
      );

      setDogInfo(formattedInfo);
      setGeneratedImage(null);
    } catch (err) {
      setError(err.message || "Failed to analyze image. Please try again.");
    } finally {
      setAnalyzing(false);
    }
  }, [image]);

  return (
    <div
      className={`min-h-screen p-2 md:p-4 ${
        darkMode ? "bg-[#000000]" : "bg-[#ffffff]"
      }`}
    >
      <div className="w-full max-w-lg mx-auto relative">
        <h1 className="text-2xl md:text-3xl font-bold text-center mb-4 font-roboto text-[#FFD700]">
          🐕 Dog Breed Finder
        </h1>

        <div
          className={`rounded-lg shadow-lg p-4 mb-4 ${
            darkMode ? "bg-[#1a1a1a]" : "bg-[#f5f5f5]"
          }`}
        >
          <div className="flex flex-col items-center gap-4">
            {uploadLoading && (
              <div className="w-full max-w-md">
                <div className="h-2 w-full bg-[#2a2a2a] rounded-full">
                  <div
                    className="h-full bg-[#FFD700] rounded-full animate-[loading_1s_ease-in-out_infinite]"
                    style={{ width: "90%" }}
                  ></div>
                </div>
                <p className="text-[#FFD700] text-center mt-2">
                  Uploading your photo...
                </p>
              </div>
            )}
            {image && !uploadLoading && (
              <div className="text-[#FFD700] text-center">
                <i className="fas fa-check-circle text-2xl mr-2"></i>
                Your photo is uploaded and ready for analysis
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 w-full">
              <label className="flex flex-col items-center p-4 bg-[#1a1a1a] rounded-lg border-2 border-dashed border-[#FFD700] cursor-pointer hover:bg-[#2a2a2a] active:bg-[#3a3a3a] transition-colors">
                <i className="fas fa-laptop text-2xl text-[#FFD700] mb-2"></i>
                <span className="text-[#FFD700] text-sm text-center">
                  Upload from Computer
                </span>
                <input
                  type="file"
                  className="hidden"
                  accept="image/*"
                  onChange={handleImageUpload}
                  disabled={uploadLoading}
                />
              </label>
              <div className="flex flex-col items-center p-4 bg-[#1a1a1a] rounded-lg border-2 border-dashed border-[#FFD700]">
                <i className="fas fa-cloud text-2xl text-[#FFD700] mb-2"></i>
                <input
                  type="text"
                  placeholder="Paste image URL"
                  className="w-full text-center text-sm bg-[#2a2a2a] text-[#FFD700] placeholder-[#FFD700]/50 border border-[#FFD700] rounded p-2"
                  onChange={(e) => {
                    if (e.target.value) {
                      upload({ url: e.target.value })
                        .then(({ url, error }) => {
                          if (error) throw error;
                          setImage(url);
                          setDogInfo(null);
                        })
                        .catch(() =>
                          setError("Failed to upload image. Please try again.")
                        );
                    }
                  }}
                />
              </div>
              <label className="flex flex-col items-center p-4 bg-[#1a1a1a] rounded-lg border-2 border-dashed border-[#FFD700] cursor-pointer hover:bg-[#2a2a2a] active:bg-[#3a3a3a] transition-colors">
                <i className="fas fa-camera text-2xl text-[#FFD700] mb-2"></i>
                <span className="text-[#FFD700] text-sm text-center">
                  Take Photo
                </span>
                <input
                  type="file"
                  className="hidden"
                  accept="image/*"
                  capture="environment"
                  onChange={handleImageUpload}
                  disabled={uploadLoading}
                />
              </label>
            </div>

            {image && (
              <div className="w-full">
                <div className="relative pb-[100%] mb-4 group perspective-[1000px]">
                  <div className="absolute inset-0 transition-transform duration-1000 transform-style-preserve-3d group-hover:rotate-y-180">
                    <div className="absolute inset-0 backface-hidden">
                      <img
                        src={image}
                        alt="Uploaded dog front view"
                        className="w-full h-full object-cover rounded-lg border-2 border-[#FFD700]"
                        style={{
                          aspectRatio: aspectRatio.replace(":", "/"),
                        }}
                      />
                    </div>
                    <div className="absolute inset-0 backface-hidden rotate-y-180">
                      <img
                        src={image}
                        alt="Uploaded dog back view"
                        className="w-full h-full object-cover rounded-lg border-2 border-[#FFD700]"
                        style={{
                          aspectRatio: aspectRatio.replace(":", "/"),
                          transform: "scaleX(-1)",
                        }}
                      />
                    </div>
                  </div>
                </div>
                <button
                  onClick={analyzeImage}
                  disabled={analyzing}
                  className="w-full py-4 bg-[#FF0000] text-[#FFD700] font-bold rounded-full button-3d shadow-[0_4px_8px_rgba(255,0,0,0.3)] hover:bg-[#CC0000] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {analyzing ? (
                    <i className="fas fa-spinner fa-spin mr-2"></i>
                  ) : (
                    <i className="fas fa-search mr-2"></i>
                  )}
                  {analyzing ? "Analyzing..." : "Analyze Dog Health"}
                </button>
              </div>
            )}

            {analyzing && (
              <div className="w-full max-w-md">
                <div className="mb-4">
                  <div className="flex justify-between mb-2">
                    <span className="text-[#FFD700]">Analysis Progress</span>
                    <span className="text-[#FFD700]">{analysisProgress}%</span>
                  </div>
                  <div className="h-2 w-full bg-[#2a2a2a] rounded-full">
                    <div
                      className="h-full bg-[#FFD700] rounded-full transition-all duration-500"
                      style={{ width: `${analysisProgress}%` }}
                    ></div>
                  </div>
                </div>
                <div className="space-y-2">
                  {analysisSteps.map((step, index) => (
                    <div
                      key={step.name}
                      className="flex items-center text-[#FFD700]"
                    >
                      {step.complete ? (
                        <i className="fas fa-check-circle mr-2"></i>
                      ) : (
                        <i
                          className={`fas fa-circle-notch mr-2 ${
                            index ===
                            analysisSteps.findIndex((s) => !s.complete)
                              ? "animate-spin"
                              : ""
                          }`}
                        ></i>
                      )}
                      {step.name}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {error && (
              <div className="text-red-500 text-center">
                <i className="fas fa-exclamation-circle mr-2"></i>
                {error}
              </div>
            )}

            {dogInfo && (
              <div className="w-full space-y-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
                  <button className="px-4 py-2 bg-[#1a1a1a] text-[#FFD700] rounded-lg border border-[#FFD700] hover:bg-[#2a2a2a] transition-colors">
                    Physical Characteristics
                  </button>
                  <button className="px-4 py-2 bg-[#1a1a1a] text-[#FFD700] rounded-lg border border-[#FFD700] hover:bg-[#2a2a2a] transition-colors">
                    Breed Overview
                  </button>
                  <button
                    onClick={generateDogImage}
                    className="px-4 py-2 bg-[#1a1a1a] text-[#FFD700] rounded-lg border border-[#FFD700] hover:bg-[#2a2a2a] transition-colors col-span-2"
                  >
                    Generate Art 🎨
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-[#1a1a1a] rounded-lg p-4 border border-[#FFD700]">
                    <h3 className="text-[#FFD700] text-lg font-bold mb-2">
                      Physical Characteristics
                    </h3>
                    <div className="text-[#FFD700] text-sm">
                      {dogInfo.physical}
                    </div>
                    <div className="mt-4">
                      <ReactGoogleMaps.APIProvider
                        apiKey={NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}
                      >
                        <div className="w-full h-[200px] relative">
                          <ReactGoogleMaps.Map
                            id="map"
                            mapId="map"
                            defaultCenter={{ lat: 0, lng: 0 }}
                            defaultZoom={2}
                            className="w-full h-full rounded-lg"
                          >
                            <ReactGoogleMaps.AdvancedMarker
                              position={{ lat: 0, lng: 0 }}
                            >
                              <div className="relative w-32 h-32">
                                <img
                                  src={image}
                                  alt="3D Dog View"
                                  className="w-full h-full object-cover rounded-full border-2 border-[#FFD700] transform rotate-y-180 transition-transform duration-1000 hover:rotate-y-0"
                                />
                              </div>
                            </ReactGoogleMaps.AdvancedMarker>
                          </ReactGoogleMaps.Map>
                        </div>
                      </ReactGoogleMaps.APIProvider>
                    </div>
                  </div>
                  {generatedImage && (
                    <div className="bg-[#1a1a1a] rounded-lg p-4 border border-[#FFD700]">
                      <h3 className="text-[#FFD700] text-lg font-bold mb-2">
                        Generated Art
                      </h3>
                      <img
                        src={generatedImage}
                        alt="AI Generated Dog Art"
                        className="w-full h-auto rounded-lg border-2 border-[#FFD700]"
                      />
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-4">
          <button
            onClick={() => setDarkMode(!darkMode)}
            className="w-14 h-14 rounded-full bg-[#FFD700] text-black flex items-center justify-center shadow-lg hover:bg-[#FFC700] transition-colors transform hover:scale-110 active:scale-95"
          >
            <i className={`fas ${darkMode ? "fa-sun" : "fa-moon"} text-lg`}></i>
          </button>
          <button
            onClick={() =>
              setAspectRatio(
                aspectRatio === "1:1"
                  ? "4:3"
                  : aspectRatio === "4:3"
                  ? "16:9"
                  : "1:1"
              )
            }
            className="w-14 h-14 rounded-full bg-[#FFD700] text-black flex items-center justify-center shadow-lg hover:bg-[#FFC700] transition-colors transform hover:scale-110 active:scale-95"
          >
            <div className="flex flex-col items-center">
              <i className="fas fa-expand text-lg"></i>
              <span className="text-xs mt-1">{aspectRatio}</span>
            </div>
          </button>
        </div>
      </div>
      <style jsx global>{`
        .perspective-[1000px] {
          perspective: 1000px;
        }
        .transform-style-preserve-3d {
          transform-style: preserve-3d;
        }
        .backface-hidden {
          backface-visibility: hidden;
        }
        .rotate-y-180 {
          transform: rotateY(180deg);
        }
        .group:hover .group-hover\\:rotate-y-180 {
          transform: rotateY(180deg);
        }
        .rotate-y-0 {
          transform: rotateY(0deg);
        }
        .translate-z-2 {
          transform: translateZ(2px);
        }
        .translate-z-4 {
          transform: translateZ(4px);
        }
        .translate-z-8 {
          transform: translateZ(8px);
        }
        .hover\\:translate-z-8:hover {
          transform: translateZ(8px);
        }
        .active\\:translate-z-2:active {
          transform: translateZ(2px);
        }
        .button-3d {
          transform-style: preserve-3d;
          transform: perspective(1000px) translateZ(0);
          transition: transform 0.3s, box-shadow 0.3s;
        }
        .button-3d:hover {
          transform: perspective(1000px) translateZ(20px);
          box-shadow: 0 10px 20px rgba(255, 215, 0, 0.3);
        }
        .button-3d:active {
          transform: perspective(1000px) translateZ(10px);
          box-shadow: 0 5px 10px rgba(255, 215, 0, 0.2);
        }
      `}</style>
    </div>
  );
}

export default MainComponent;