"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isOTPExpired = exports.generateOTP = void 0;
const generateOTP = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
};
exports.generateOTP = generateOTP;
const isOTPExpired = (otpExpires) => {
    return new Date() > otpExpires;
};
exports.isOTPExpired = isOTPExpired;
