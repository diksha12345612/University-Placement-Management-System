const fs = require('fs');
const file = 'client/src/pages/student/AIMockInterview.jsx';
let content = fs.readFileSync(file, 'utf8');

const regex = /\{step === 'evaluation' \&\& evaluation \&\& \([\s\S]*?\}\)\}[\s]*\}[\s]*<\/div>[\s]*<\/Layout>[\s]*\);[\s]*\};/g;

const newEval = {step === 'evaluation' && evaluation && (
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-10 text-left">
                        <div className="text-center mb-10 pb-6 border-b border-gray-100">
                            <FiCheckCircle className="w-8 h-8 text-black mx-auto mb-4" />
                            <h2 className="text-3xl font-extrabold text-gray-900">Interview Completed</h2>
                            <p className="text-gray-600 mt-2">Here is your comprehensive AI performance report.</p>
                        </div>

                        <div className="mb-10 flex justify-center">
                            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm w-56 text-center">
                                <h3 className="text-black font-extrabold mb-3 uppercase tracking-wider text-xs">Overall Score</h3>
                                <div className="text-5xl font-light text-blue-600">{evaluation.score || 0}<span className="text-3xl text-blue-600/50">/100</span></div>
                            </div>
                        </div>

                        <div className="mb-10">
                            <h3 className="text-md font-extrabold text-black mb-4">Detailed Feedback</h3>
                            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                                <p className="text-gray-700 leading-relaxed text-md">
                                    {evaluation.feedback}
                                </p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6"> 
                            <div className="bg-white border border-gray-100 p-6 rounded-2xl shadow-sm">
                                <h3 className="text-black font-extrabold mb-4 flex items-center gap-2 text-md">
                                    <FiCheckCircle className="w-5 h-5 text-black" />
                                    Core Strengths
                                </h3>
                                <ul className="space-y-3 text-gray-700">
                                    {(evaluation.strengths || []).map((s, i) => <li key={i} className="leading-snug">{s}</li>)}
                                </ul>
                            </div>
                            <div className="bg-white border border-gray-100 p-6 rounded-2xl shadow-sm">
                                <h3 className="text-black font-extrabold mb-4 flex items-center gap-2 text-md">
                                    <FiCheckCircle className="w-5 h-5 text-black" />
                                    Areas for Improvement
                                </h3>
                                <ul className="space-y-3 text-gray-700">
                                    {(evaluation.improvements || []).map((s, i) => <li key={i} className="leading-snug">{s}</li>)}
                                </ul>
                            </div>
                        </div>

                        <div className="mt-12 text-center border-t border-gray-100 pt-8">       
                             <button
                                onClick={() => {
                                    setStep('setup');
                                    setChatHistory([]);
                                    setEvaluation(null);
                                    if (typeof setCandidateProfile === 'function') setCandidateProfile(null);
                                }}
                                className="w-64 mx-auto bg-blue-600 text-white py-4 rounded-xl font-bold text-sm hover:bg-blue-700 transition shadow-sm"
                             >
                                Start New Interview
                             </button>
                        </div>
                    </div>
                )}
            </div>
        </Layout>
    );
};;

content = content.replace(regex, newEval);
fs.writeFileSync(file, content, 'utf8');
