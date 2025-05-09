import React from "react";
import { Link } from "react-router-dom";

export default function Login() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50">
      <h2 className="text-2xl font-bold mb-4">Login</h2>
      <form className="flex flex-col space-y-2 w-72">
        <input type="email" placeholder="Email" className="p-2 border rounded" />
        <input type="password" placeholder="Password" className="p-2 border rounded" />
        <button className="bg-blue-600 text-white py-2 rounded">Login</button>
      </form>
      <p className="mt-4">
        No account? <Link to="/signup" className="text-blue-600 underline">Sign up</Link>
      </p>
    </div>
  );
}
