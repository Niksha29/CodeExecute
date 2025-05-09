import React from "react";
import { Link } from "react-router-dom";

export default function Dashboard() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50">
      <h1 className="text-3xl font-bold mb-4">Welcome to CodeExecute!</h1>
      <Link
        to="/editor"
        className="bg-blue-600 text-white px-6 py-3 rounded shadow hover:bg-blue-700 transition"
      >
        Go to Editor
      </Link>
    </div>
  );
}
