// ==========================================
// LogSweeper Test File
// ==========================================

// 1. Standard logs (Should be commented)
 console.log("Standard log 1: Simple text"); 
 console.log('Standard log 2: Single quotes'); 

// 2. Nested parentheses log (Should be cleanly commented)
 console.log(Math.max(10, Math.min(5, 20))); 

// 3. Multiline console.log (Should be commented and keep lines matched)
console.log(
    "Multiline log",
    {
        user: "Faraz",
        active: true
    }
); 

// 4. Already commented single-line log (Should be skipped)
console.log("I am already single-line commented out. Skip me!");

// 5. Already commented inline block log (Should be skipped)
 console.log("I am already inline block commented out. Skip me!"); 

// 6. Already commented multi-line block log (Should be skipped)

  // This is a block comment block.
  console.log("I am inside a multi-line block. Skip me!");
  console.log("Skip me too!");

// 7. Console log inside a string literal (Should be skipped)
const demoString = "This is a string literal containing console.log('Ignore me!'); and it should not be touched.";
console.log(demoString);

// 8. Log with no semicolon (Should be commented and match successfully)
console.log("No semicolon at the end")
const nextLine = true;
