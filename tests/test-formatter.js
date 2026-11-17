/**
 * Automated Unit & Integration Tests for LeetCode C# Formatter
 */

const assert = require('assert');
const { formatCSharpCode, validate, tokenize } = require('../formatter/index');

let passedTests = 0;
let totalTests = 0;

function runTest(name, fn) {
  totalTests++;
  try {
    fn();
    console.log(`  ✓ PASS: ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ✗ FAIL: ${name}`);
    console.error(`    ${err.message}`);
  }
}

console.log('Running LeetCode C# Formatter Test Suite...\n');

// Test 1: Real LeetCode Two Sum
runTest('LeetCode 1: Two Sum with messy indentation and missing spaces', () => {
  const unformatted = `public class Solution {
public int[] TwoSum(int[] nums,int target){
Dictionary<int,int> map=new Dictionary<int,int>();
for(int i=0;i<nums.Length;i++){
int complement=target-nums[i];
if(map.ContainsKey(complement)){
return new int[]{map[complement],i};
}
map[nums[i]]=i;
}
return new int[0];
}
}`;

  const res = formatCSharpCode(unformatted);
  assert.strictEqual(res.success, true, `Formatting failed: ${res.error}`);
  assert.ok(res.formattedCode.includes('public class Solution\n{'), 'Class must have Allman open brace');
  assert.ok(res.formattedCode.includes('public int[] TwoSum(int[] nums, int target)\n    {'), 'Method must have Allman open brace with indentation');
  assert.ok(res.formattedCode.includes('Dictionary<int, int> map = new Dictionary<int, int>();'), 'Generics and operator spacing');
  assert.ok(res.formattedCode.includes('for (int i = 0; i < nums.Length; i++)'), 'For loop spacing');
  assert.ok(res.formattedCode.includes('int complement = target - nums[i];'), 'Binary minus spacing');
  assert.ok(res.formattedCode.includes('if (map.ContainsKey(complement))'), 'If condition spacing');

  // Verify semantic preservation
  const val = validate(unformatted, res.formattedCode);
  assert.strictEqual(val.isValid, true, `Safety check failed: ${val.error}`);
});

// Test 2: Real LeetCode LRU Cache (Nested classes, properties, methods)
runTest('LeetCode 146: LRU Cache complex class structure', () => {
  const unformatted = `public class LRUCache {
private class Node{
public int key;
public int val;
public Node prev;
public Node next;
public Node(int k,int v){key=k;val=v;}
}
private int capacity;
private Dictionary<int,Node> cache;
private Node head;
private Node tail;
public LRUCache(int capacity) {
this.capacity=capacity;
cache=new Dictionary<int,Node>();
head=new Node(0,0);
tail=new Node(0,0);
head.next=tail;
tail.prev=head;
}
public int Get(int key) {
if(!cache.ContainsKey(key))return -1;
Node node=cache[key];
Remove(node);
Insert(node);
return node.val;
}
private void Remove(Node node){
node.prev.next=node.next;
node.next.prev=node.prev;
}
private void Insert(Node node){
node.next=head.next;
node.prev=head;
head.next.prev=node;
head.next=node;
}
}`;

  const res = formatCSharpCode(unformatted);
  assert.strictEqual(res.success, true, `Formatting failed: ${res.error}`);
  const val = validate(unformatted, res.formattedCode);
  assert.strictEqual(val.isValid, true, `Safety check failed: ${val.error}`);
});

// Test 3: String literals, verbatim strings, interpolated strings
runTest('Preserves string literals byte-for-byte without modifying content', () => {
  const code = `public class TestStrings {
public void Print() {
string normal = "Hello   World!   Do   Not   Touch   Spaces!";
string verbatim = @"C:\\Path\\With   Spaces\\And\\Tabs";
string interpolated = $"Count: {42}   spaces   here";
char ch = ' ';
}
}`;

  const res = formatCSharpCode(code);
  assert.strictEqual(res.success, true);
  assert.ok(res.formattedCode.includes('"Hello   World!   Do   Not   Touch   Spaces!"'));
  assert.ok(res.formattedCode.includes('@"C:\\Path\\With   Spaces\\And\\Tabs"'));
  assert.ok(res.formattedCode.includes('$"Count: {42}   spaces   here"'));
  assert.ok(res.formattedCode.includes("' '"));

  const val = validate(code, res.formattedCode);
  assert.strictEqual(val.isValid, true);
});

// Test 4: Operators formatting
runTest('Spaces around binary, ternary, assignment, and lambda operators', () => {
  const code = `public class Operators {
public void Calc() {
int a=1+2*3/4%5;
bool b=(a==1)&&(a!=2)||(a<=10)&&(a>=0);
int? c=null;
int d=c??-1;
Func<int,int> f=x=>x*2;
int max=a>b.GetHashCode()?a:0;
a+=10;
a-=5;
a*=2;
}
}`;

  const res = formatCSharpCode(code);
  assert.strictEqual(res.success, true);
  assert.ok(res.formattedCode.includes('1 + 2 * 3 / 4 % 5;'));
  assert.ok(res.formattedCode.includes('== 1) && (a != 2) || (a <= 10) && (a >= 0);'));
  assert.ok(res.formattedCode.includes('c ?? -1;'));
  assert.ok(res.formattedCode.includes('x => x * 2;'));
  assert.ok(res.formattedCode.includes('? a : 0;'));
  assert.ok(res.formattedCode.includes('a += 10;'));
  assert.ok(res.formattedCode.includes('a -= 5;'));
  assert.ok(res.formattedCode.includes('a *= 2;'));

  const val = validate(code, res.formattedCode);
  assert.strictEqual(val.isValid, true);
});

// Test 5: Switch, Case, Try, Catch, Finally
runTest('Switch statements, case labels, and try-catch-finally', () => {
  const code = `public class ControlFlow {
public string Check(int val) {
try {
switch (val) {
case 1:
return "one";
case 2:
return "two";
default:
return "other";
}
} catch (Exception ex) {
throw ex;
} finally {
// clean up
}
}
}`;

  const res = formatCSharpCode(code);
  assert.strictEqual(res.success, true);
  assert.ok(res.formattedCode.includes('try\n'));
  assert.ok(res.formattedCode.includes('switch (val)\n'));
  assert.ok(res.formattedCode.includes('case 1:\n'));
  assert.ok(res.formattedCode.includes('catch (Exception ex)\n'));
  assert.ok(res.formattedCode.includes('finally\n'));

  const val = validate(code, res.formattedCode);
  assert.strictEqual(val.isValid, true);
});

// Test 6: Comments preservation (single-line and multi-line)
runTest('Comments are preserved and properly positioned', () => {
  const code = `// Class level comment
public class Solution {
    /* Multi-line
       block comment */
    public int Solve() {
        int x = 10; // Trailing comment
        return x;
    }
}`;

  const res = formatCSharpCode(code);
  assert.strictEqual(res.success, true);
  assert.ok(res.formattedCode.includes('// Class level comment'));
  assert.ok(res.formattedCode.includes('/* Multi-line'));
  assert.ok(res.formattedCode.includes('// Trailing comment'));

  const val = validate(code, res.formattedCode);
  assert.strictEqual(val.isValid, true);
});

// Test 7: Safety rejection test (Token modification detection)
runTest('Safety Validator rejects any corrupted code', () => {
  const original = `int a = 1;`;
  const corrupted = `int a = 2;`; // altered value
  const val = validate(original, corrupted);
  assert.strictEqual(val.isValid, false, 'Validator must reject altered tokens');
  assert.ok(val.error.includes('Token value altered'));
});

console.log(`\nTests completed: ${passedTests}/${totalTests} passed.`);
if (passedTests !== totalTests) {
  process.exit(1);
}

// Test 8: LeetCode 124 - Binary Tree Maximum Path Sum (recursion, class TreeNode, Math.Max)
runTest('LeetCode 124: Binary Tree Maximum Path Sum', () => {
  const code = `public class TreeNode {
public int val;
public TreeNode left;
public TreeNode right;
public TreeNode(int val=0, TreeNode left=null, TreeNode right=null) {
this.val = val;
this.left = left;
this.right = right;
}
}
public class Solution {
private int maxSum=int.MinValue;
public int MaxPathSum(TreeNode root) {
Dfs(root);
return maxSum;
}
private int Dfs(TreeNode node){
if(node==null) return 0;
int leftGain=Math.Max(Dfs(node.left),0);
int rightGain=Math.Max(Dfs(node.right),0);
int currentPrice=node.val+leftGain+rightGain;
maxSum=Math.Max(maxSum,currentPrice);
return node.val+Math.Max(leftGain,rightGain);
}
}`;

  const res = formatCSharpCode(code);
  assert.strictEqual(res.success, true, `Formatting failed: ${res.error}`);
  assert.ok(res.formattedCode.includes('public class TreeNode\n{'));
  assert.ok(res.formattedCode.includes('int leftGain = Math.Max(Dfs(node.left), 0);'));
  assert.ok(res.formattedCode.includes('maxSum = Math.Max(maxSum, currentPrice);'));

  const val = validate(code, res.formattedCode);
  assert.strictEqual(val.isValid, true);
});

// Test 9: C# 11 Raw String Literals and Preprocessor Directives
runTest('Raw String Literals and Preprocessor Directives', () => {
  const code = `#region Algorithms
public class Solution {
    public string GetTemplate() {
        string json = """
{
    "status": 200,
    "ok": true
}
""";
        return json;
    }
}
#endregion`;

  const res = formatCSharpCode(code);
  assert.strictEqual(res.success, true);
  assert.ok(res.formattedCode.includes('#region Algorithms'));
  assert.ok(res.formattedCode.includes('#endregion'));
  assert.ok(res.formattedCode.includes('"""'));

  const val = validate(code, res.formattedCode);
  assert.strictEqual(val.isValid, true);
});

// Test 10: Generics with Tuples e.g. PriorityQueue<(int, int), int>
runTest('Complex generics with tuples', () => {
  const code = `public class Solution {
public void Process() {
PriorityQueue<(int, int), int> pq = new PriorityQueue<(int, int), int>();
var list = new List<IList<int>>();
}
}`;

  const res = formatCSharpCode(code);
  assert.strictEqual(res.success, true);
  assert.ok(res.formattedCode.includes('PriorityQueue<(int, int), int> pq = new PriorityQueue<(int, int), int>();'));
  assert.ok(res.formattedCode.includes('var list = new List<IList<int>>();'));

  const val = validate(code, res.formattedCode);
  assert.strictEqual(val.isValid, true);
});

// Test 11: Modern C# 8+ Switch Expressions and Record Types
runTest('Switch expressions and records', () => {
  const code = `public record Point(int X, int Y);
public class Solution {
public string Describe(int code) => code switch {
1 => "One",
2 => "Two",
_ => "Unknown"
};
}`;

  const res = formatCSharpCode(code);
  assert.strictEqual(res.success, true);
  assert.ok(res.formattedCode.includes('public record Point(int X, int Y);'));
  assert.ok(res.formattedCode.includes('code switch'));
  assert.ok(res.formattedCode.includes('1 => "One",'));

  const val = validate(code, res.formattedCode);
  assert.strictEqual(val.isValid, true);
});

// Test 12: Null-coalescing assignment and LINQ
runTest('Null-coalescing assignment and LINQ chains', () => {
  const code = `public class Solution {
public int Calculate(List<int> numbers) {
numbers ??= new List<int>();
var result = numbers.Where(x => x > 0).Select(x => x * 2).ToList();
return result.Count;
}
}`;

  const res = formatCSharpCode(code);
  assert.strictEqual(res.success, true);
  assert.ok(res.formattedCode.includes('numbers ??= new List<int>();'));
  assert.ok(res.formattedCode.includes('numbers.Where(x => x > 0).Select(x => x * 2).ToList();'));

  const val = validate(code, res.formattedCode);
  assert.strictEqual(val.isValid, true);
});

// Test 13: Object Initializer
runTest('Object Initializer syntax', () => {
  const code = `public class Solution {
public void Init() {
var node = new TreeNode {
val = 5,
left = null,
right = null
};
}
}`;

  const res = formatCSharpCode(code);
  assert.strictEqual(res.success, true);
  const val = validate(code, res.formattedCode);
  assert.strictEqual(val.isValid, true);
});
