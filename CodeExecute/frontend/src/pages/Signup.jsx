import React from "react";
import { Link } from "react-router-dom";

export default function Signup() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50">
      <h2 className="text-2xl font-bold mb-4">Sign Up</h2>
      <form className="flex flex-col space-y-2 w-72">
        <input
          type="email"
          placeholder="Email"
          className="p-2 border rounded"
        />
        <input
          type="password"
          placeholder="Password"
          className="p-2 border rounded"
        />
        <button className="bg-green-600 text-white py-2 rounded">
          Sign Up
        </button>
      </form>
      <p className="mt-4">
        Already have an account?{" "}
        <Link to="/login" className="text-blue-600 underline">
          Login
        </Link>
      </p>
    </div>
  );
}
