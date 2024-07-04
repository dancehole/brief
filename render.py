from jinja2 import Environment, FileSystemLoader
import json

NAME = 'cyy'    # 全局定义文件名/输入输出

# 加载模板环境
env = Environment(loader=FileSystemLoader('templates'))  # 假设模板文件在'templates'目录下
template = env.get_template('template.html')

# 加载JSON数据
with open(f'./json/{NAME}.json', 'r', encoding='utf-8') as file:
    data = json.load(file)

# 渲染模板
output_html = template.render(data)

# 打印或保存输出
# print(output_html)
# 或者保存到文件
with open(f'./output/{NAME}.html', 'w', encoding='utf-8') as file:
    file.write(output_html)
    print("写入成功！")