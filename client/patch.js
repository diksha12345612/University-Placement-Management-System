const fs = require('fs');
const file = 'client/src/pages/student/AIMockInterview.jsx';
let content = fs.readFileSync(file, 'utf8');

const oldStr = className="w-full mt-6 bg-blue-600 text-white py-4 rounded-xl font-bold text-lg hover:bg-blue-700 transition shadow-sm flex items-center justify-center disabled:opacity-70 disabled:cursor-not-allowed"        
                                    <>
                                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white";

const newStr = className="w-full mt-6 bg-blue-600 text-white py-4 rounded-xl font-bold text-lg hover:bg-blue-700 transition shadow-sm flex items-center justify-center disabled:opacity-70 disabled:cursor-not-allowed"
                            >
                                {isLoading ? (
                                    <>
                                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white";

content = content.replace(oldStr, newStr);
fs.writeFileSync(file, content, 'utf8');
