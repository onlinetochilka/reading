text = open('app.js', encoding='utf-8').read()
braces = 0
for i, char in enumerate(text):
    if char == '{': braces += 1
    elif char == '}':
        braces -= 1
        if braces < 0: print('Negative braces at index', i)
print('Final braces:', braces)
