from jinja2 import Environment, FileSystemLoader
import json

# 加载模板环境
env = Environment(loader=FileSystemLoader('templates'))  # 假设模板文件在'templates'目录下
template = env.get_template('dsh.html')

# 加载JSON数据
with open('./json/dsh.json', 'r', encoding='utf-8') as file:
    data = json.load(file)

# 渲染模板
output_html = template.render(data)

# 打印或保存输出
# print(output_html)
# 或者保存到文件
with open('output_profile.html', 'w', encoding='utf-8') as file:
    file.write(output_html)